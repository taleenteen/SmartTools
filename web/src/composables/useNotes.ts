import { ref, computed } from 'vue'
import type {
  NoteItemFull,
  NoteItemSummary,
  NoteProject,
  NotesIndex,
  NoteViewMode,
  NoteFolderViewStyle
} from '@/types/note'

const INDEX_CACHE_KEY = 'smarttools-notes-index'
const VIEW_MODE_KEY = 'smarttools-notes-viewmode'
const FOLDER_STYLE_KEY = 'smarttools-notes-folderstyle'

// Module-level singleton state
const projects = ref<NoteProject[]>([])
const notes = ref<NoteItemSummary[]>([])
const currentNote = ref<NoteItemFull | null>(null)
const activeProjectId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error' | 'unsaved'>('idle')
const lastSavedAt = ref<Date | null>(null)
const searchQuery = ref('')

// Initialize view settings from localStorage
const initialViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_MODE_KEY) as NoteViewMode) || 'card'
const initialFolderStyle = (typeof localStorage !== 'undefined' && localStorage.getItem(FOLDER_STYLE_KEY) as NoteFolderViewStyle) || 'cover'

const viewMode = ref<NoteViewMode>(initialViewMode)
const folderViewStyle = ref<NoteFolderViewStyle>(initialFolderStyle)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function useNotes() {
  function setViewMode(mode: NoteViewMode) {
    viewMode.value = mode
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      /* ignore storage quota */
    }
  }

  function setFolderViewStyle(style: NoteFolderViewStyle) {
    folderViewStyle.value = style
    try {
      localStorage.setItem(FOLDER_STYLE_KEY, style)
    } catch {
      /* ignore storage quota */
    }
  }

  // Restore cached index immediately for zero-lag UI
  function restoreLocalIndex() {
    try {
      const cached = localStorage.getItem(INDEX_CACHE_KEY)
      if (cached) {
        const parsed: NotesIndex = JSON.parse(cached)
        if (Array.isArray(parsed.projects)) projects.value = parsed.projects
        if (Array.isArray(parsed.notes)) notes.value = parsed.notes
      }
    } catch {
      /* ignore malformed cache */
    }
  }

  function cacheIndexLocally() {
    try {
      localStorage.setItem(
        INDEX_CACHE_KEY,
        JSON.stringify({ projects: projects.value, notes: notes.value })
      )
    } catch {
      /* ignore quota */
    }
  }

  async function loadNotesIndex(force = false) {
    if (notes.value.length === 0 || force) {
      restoreLocalIndex()
    }

    loading.value = true
    try {
      const res = await fetch('/api/notes', { credentials: 'same-origin' })
      if (!res.ok) {
        if (res.status === 401) {
          // Unauthenticated: keep cached data if available
          return { ok: false, error: 'Unauthorized', status: 401 }
        }
        throw new Error(`Failed to load notes (${res.status})`)
      }
      const data = await res.json()
      if (data.ok && data.index) {
        projects.value = Array.isArray(data.index.projects) ? data.index.projects : []
        notes.value = Array.isArray(data.index.notes) ? data.index.notes : []
        cacheIndexLocally()
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    } finally {
      loading.value = false
    }
  }

  function cancelPendingSave() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (saveStatus.value === 'unsaved') {
      saveStatus.value = 'idle'
    }
  }

  async function loadNote(id: string): Promise<NoteItemFull | null> {
    cancelPendingSave()

    // 1. Check localStorage cache first
    let cachedNote: NoteItemFull | null = null
    try {
      const cached = localStorage.getItem(`smarttools-note-${id}`)
      if (cached) {
        cachedNote = JSON.parse(cached)
        currentNote.value = cachedNote
      }
    } catch {
      /* ignore */
    }

    // 2. If not in cache, initialize currentNote with summary immediately so it never shows previous note
    if (!cachedNote) {
      const summary = notes.value.find(n => n.id === id)
      if (summary) {
        currentNote.value = {
          ...summary,
          content: ''
        }
      }
    }

    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.ok && data.note) {
        // Only update currentNote if the user is still on this note
        if (currentNote.value?.id === id) {
          currentNote.value = data.note
        }
        try {
          localStorage.setItem(`smarttools-note-${id}`, JSON.stringify(data.note))
        } catch {
          /* ignore */
        }
        return data.note
      }
      return null
    } catch (err) {
      // Return cached note if network failed
      if (currentNote.value && currentNote.value.id === id) {
        return currentNote.value
      }
      throw err
    }
  }

  async function saveNote(noteData: Partial<NoteItemFull>): Promise<NoteItemFull> {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    saveStatus.value = 'saving'
    saving.value = true

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'save_note', note: noteData })
      })

      if (!res.ok) {
        throw new Error(`Save failed (HTTP ${res.status})`)
      }

      const data = await res.json()
      if (!data.ok || !data.note) {
        throw new Error(data.error || 'Unknown save error')
      }

      const savedNote: NoteItemFull = data.note

      // Only update currentNote if the user is still on this note
      if (currentNote.value && (currentNote.value.id === savedNote.id || (!currentNote.value.id && !noteData.id))) {
        currentNote.value = savedNote
      }

      // Update in-memory summary list
      const idx = notes.value.findIndex(n => n.id === savedNote.id)
      const summary: NoteItemSummary = {
        id: savedNote.id,
        title: savedNote.title,
        snippet: savedNote.snippet,
        coverUrl: savedNote.coverUrl,
        projectId: savedNote.projectId,
        pinned: savedNote.pinned,
        order: savedNote.order,
        wordCount: savedNote.wordCount,
        charCount: savedNote.charCount,
        createdAt: savedNote.createdAt,
        updatedAt: savedNote.updatedAt
      }

      if (idx >= 0) {
        notes.value[idx] = summary
      } else {
        notes.value.unshift(summary)
      }

      // Update local storage caches
      try {
        localStorage.setItem(`smarttools-note-${savedNote.id}`, JSON.stringify(savedNote))
        cacheIndexLocally()
      } catch {
        /* ignore */
      }

      saveStatus.value = 'saved'
      lastSavedAt.value = new Date()
      return savedNote
    } catch (err) {
      saveStatus.value = 'error'
      throw err
    } finally {
      saving.value = false
    }
  }

  function queueDebouncedSave(noteData: Partial<NoteItemFull>, delayMs = 1500) {
    saveStatus.value = 'unsaved'
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const targetId = noteData.id
    debounceTimer = setTimeout(() => {
      // If user switched to another note while waiting, abandon saving the old note
      if (targetId && currentNote.value?.id && currentNote.value.id !== targetId) {
        return
      }
      void saveNote(noteData).catch(() => {
        /* error handled in saveNote */
      })
    }, delayMs)
  }

  async function deleteNote(id: string): Promise<boolean> {
    cancelPendingSave()
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.ok) {
        notes.value = notes.value.filter(n => n.id !== id)
        if (currentNote.value?.id === id) {
          currentNote.value = null
        }
        try {
          localStorage.removeItem(`smarttools-note-${id}`)
          cacheIndexLocally()
        } catch {
          /* ignore */
        }
        return true
      }
      return false
    } catch (err) {
      console.error('Delete note failed', err)
      throw err
    }
  }

  async function togglePin(id: string) {
    const summary = notes.value.find(n => n.id === id)
    if (!summary) return
    const newPinned = !summary.pinned
    summary.pinned = newPinned

    // Save update
    await saveNote({
      ...summary,
      pinned: newPinned
    })
  }

  async function saveProject(projectData: Partial<NoteProject>): Promise<NoteProject> {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'save_project', project: projectData })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.ok || !data.project) throw new Error(data.error || 'Failed to save project')

    const saved: NoteProject = data.project
    const idx = projects.value.findIndex(p => p.id === saved.id)
    if (idx >= 0) {
      projects.value[idx] = saved
    } else {
      projects.value.push(saved)
    }
    cacheIndexLocally()
    return saved
  }

  async function deleteProject(projectId: string, deleteNotes = false): Promise<boolean> {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'delete_project', projectId, deleteNotes })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.ok) {
      projects.value = projects.value.filter(p => p.id !== projectId)
      if (deleteNotes) {
        notes.value = notes.value.filter(n => n.projectId !== projectId)
      } else {
        notes.value.forEach(n => {
          if (n.projectId === projectId) n.projectId = null
        })
      }
      if (activeProjectId.value === projectId) {
        activeProjectId.value = null
      }
      cacheIndexLocally()
      return true
    }
    return false
  }

  async function reorderNotes(orderedIds: string[]): Promise<void> {
    const idToOrder = new Map<string, number>()
    orderedIds.forEach((id, index) => idToOrder.set(id, index))

    notes.value.forEach(note => {
      if (idToOrder.has(note.id)) {
        note.order = idToOrder.get(note.id)!
      }
    })

    cacheIndexLocally()

    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'reorder_notes', orderedIds })
    })
  }

  function exportNote(note: NoteItemFull, format: 'md' | 'html' | 'txt') {
    let content = ''
    let mimeType = 'text/plain'
    let ext = 'txt'

    if (format === 'html') {
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${note.title}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a1a;}</style></head><body><h1>${note.title}</h1>${note.content}</body></html>`
      mimeType = 'text/html'
      ext = 'html'
    } else if (format === 'md') {
      // Basic HTML to Markdown converter
      content = `# ${note.title}\n\n` + note.content
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i>(.*?)<\/i>/gi, '*$1*')
        .replace(/<code>(.*?)<\/code>/gi, '`$1`')
        .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<ul[^>]*>/gi, '')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<br\s*[/]?>/gi, '\n')
        .replace(/<[^>]+>/gi, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
      mimeType = 'text/markdown'
      ext = 'md'
    } else {
      content = `${note.title}\n\n` + note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      mimeType = 'text/plain'
      ext = 'txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredNotes = computed(() => {
    let list = [...notes.value]

    // Active project filter
    if (activeProjectId.value === 'standalone') {
      list = list.filter(n => !n.projectId)
    } else if (activeProjectId.value === 'pinned') {
      list = list.filter(n => n.pinned)
    } else if (activeProjectId.value) {
      list = list.filter(n => n.projectId === activeProjectId.value)
    }

    // Search query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.snippet.toLowerCase().includes(q))
    }

    // Sort: Pinned first, then by order, then by updatedAt
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.order !== b.order) return a.order - b.order
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  })

  const currentProject = computed(() => {
    if (!activeProjectId.value || activeProjectId.value === 'standalone' || activeProjectId.value === 'pinned') {
      return null
    }
    return projects.value.find(p => p.id === activeProjectId.value) || null
  })

  return {
    projects,
    notes,
    currentNote,
    activeProjectId,
    currentProject,
    filteredNotes,
    loading,
    saving,
    saveStatus,
    lastSavedAt,
    viewMode,
    folderViewStyle,
    searchQuery,
    setViewMode,
    setFolderViewStyle,
    loadNotesIndex,
    loadNote,
    saveNote,
    queueDebouncedSave,
    deleteNote,
    togglePin,
    saveProject,
    deleteProject,
    reorderNotes,
    exportNote,
    cancelPendingSave
  }
}
