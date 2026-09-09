<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  FileText,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Folder,
  FolderPlus,
  ArrowLeft,
  AlertTriangle,
  FolderKanban,
} from 'lucide-vue-next'

import AppNavbar from '@/components/bookmarks/AppNavbar.vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import NoteListItem from '@/components/notes/NoteListItem.vue'
import ProjectCard from '@/components/notes/ProjectCard.vue'
import NoteEditorDialog from '@/components/notes/NoteEditorDialog.vue'
import ProjectEditorDialog from '@/components/notes/ProjectEditorDialog.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotes } from '@/composables/useNotes'
import { t } from '@/i18n/th'
import { useSessionStore } from '@/stores/session'
import type { NoteItemSummary, NoteProject } from '@/types/note'

const session = useSessionStore()
const {
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
  cancelPendingSave,
} = useNotes()

// Modal states
const noteEditorOpen = ref(false)
const projectEditorOpen = ref(false)
const editingProject = ref<NoteProject | null>(null)
const showLoginAlert = ref(false)

// Delete alert dialog state
const deleteAlertOpen = ref(false)
const itemToDelete = ref<{ type: 'note' | 'project'; id: string; title: string } | null>(null)

// Project note count map
const projectNoteCounts = computed(() => {
  const counts = new Map<string, number>()
  notes.value.forEach((n) => {
    if (n.projectId) {
      counts.set(n.projectId, (counts.get(n.projectId) || 0) + 1)
    }
  })
  return counts
})

// Current visible projects (when not drilled into a specific project)
const visibleProjects = computed(() => {
  if (activeProjectId.value) return []
  if (!searchQuery.value.trim()) return projects.value
  const q = searchQuery.value.toLowerCase()
  return projects.value.filter(
    (p) => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  await session.check()
  await loadNotesIndex()
})

// Handlers for creating / editing notes
function handleCreateNote() {
  if (!session.loggedIn) {
    showLoginAlert.value = true
    return
  }
  cancelPendingSave()
  currentNote.value = {
    id: '',
    title: '',
    content: '',
    snippet: '',
    projectId: (activeProjectId.value && activeProjectId.value !== 'standalone' && activeProjectId.value !== 'pinned') ? activeProjectId.value : null,
    pinned: false,
    order: notes.value.length,
    wordCount: 0,
    charCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  noteEditorOpen.value = true
}

function handleOpenNote(summary: NoteItemSummary) {
  cancelPendingSave()

  // 1. Check local cache or initialize currentNote immediately with summary
  // This guarantees 0ms UI lag - modal opens INSTANTLY!
  let cachedContent = ''
  try {
    const cached = localStorage.getItem(`smarttools-note-${summary.id}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed && typeof parsed.content === 'string') {
        cachedContent = parsed.content
      }
    }
  } catch {
    /* ignore */
  }

  currentNote.value = {
    ...summary,
    content: cachedContent,
  }

  // 2. Open editor modal immediately
  noteEditorOpen.value = true

  // 3. Fetch latest full content from KV in the background
  void loadNote(summary.id).catch((err) => {
    console.error('Error opening note', err)
  })
}

function handleCreateProject() {
  if (!session.loggedIn) {
    showLoginAlert.value = true
    return
  }
  editingProject.value = null
  projectEditorOpen.value = true
}

function handleEditProject(project: NoteProject) {
  if (!session.loggedIn) {
    showLoginAlert.value = true
    return
  }
  editingProject.value = { ...project }
  projectEditorOpen.value = true
}

// Project drilldown navigation
function handleOpenProject(project: NoteProject) {
  activeProjectId.value = project.id
}

function handleBackToRoot() {
  activeProjectId.value = null
}

// Note reordering inside project
function handleMoveNote(id: string, direction: 'up' | 'down') {
  const currentList = [...filteredNotes.value]
  const idx = currentList.findIndex((n) => n.id === id)
  if (idx < 0) return

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= currentList.length) return

  // Swap
  const currentItem = currentList[idx]
  const targetItem = currentList[targetIdx]
  if (currentItem && targetItem) {
    currentList[idx] = targetItem
    currentList[targetIdx] = currentItem
    const orderedIds = currentList.map((n) => n.id)
    void reorderNotes(orderedIds)
  }
}

// Delete confirmations
function confirmDeleteNote(id: string) {
  const n = notes.value.find((item) => item.id === id)
  itemToDelete.value = { type: 'note', id, title: n?.title || 'โน้ตนี้' }
  deleteAlertOpen.value = true
}

function confirmDeleteProject(project: NoteProject) {
  itemToDelete.value = { type: 'project', id: project.id, title: project.title }
  deleteAlertOpen.value = true
}

async function handleConfirmDelete() {
  if (!itemToDelete.value) return
  if (itemToDelete.value.type === 'note') {
    await deleteNote(itemToDelete.value.id)
  } else {
    await deleteProject(itemToDelete.value.id, false)
  }
  deleteAlertOpen.value = false
  itemToDelete.value = null
}

// Saving Project modal
async function handleSaveProject(data: Partial<NoteProject>) {
  await saveProject(data)
  projectEditorOpen.value = false
}

// Export Note
function handleExportNote(noteSummary: NoteItemSummary, format: 'md' | 'html' | 'txt') {
  void loadNote(noteSummary.id).then((full) => {
    if (full) exportNote(full, format)
  })
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col">
    <div class="flex-1 w-full max-w-md sm:max-w-3xl lg:max-w-6xl mx-auto px-4 py-4 flex flex-col">
      <AppNavbar />

      <!-- Page Title & Stats -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{{ t.notes }}</h1>
            <span class="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
              {{ notes.length }}
            </span>
          </div>
          <p class="mt-1 text-xs sm:text-sm text-muted-foreground">
            {{ t.notesSubtitle }}
          </p>
        </div>
      </div>

      <!-- Visitor Notice Banner -->
      <div
        v-if="!session.loggedIn"
        class="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4 text-xs sm:text-sm text-amber-700 dark:text-amber-400"
      >
        <div class="flex items-center gap-2.5">
          <AlertTriangle class="size-5 shrink-0" />
          <span>{{ t.notesVisitorNotice }}</span>
        </div>
        <Button as-child size="sm" class="h-8 rounded-full text-xs font-semibold shrink-0">
          <RouterLink to="/settings">{{ t.login }}</RouterLink>
        </Button>
      </div>

      <!-- 2. SEARCH & ACTION CONTROLS BAR -->
      <div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <!-- Search input -->
        <div class="relative flex-1">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            type="search"
            :placeholder="t.notesSearchPlaceholder"
            class="h-12 pl-11 pr-4 text-sm sm:text-base rounded-full shadow-sm bg-card border-border/80"
          />
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- View Switcher (Card vs Google Drive List) -->
          <div class="flex items-center p-1 bg-muted/60 rounded-full border border-border/60">
            <Button
              variant="ghost"
              size="icon"
              :class="['size-10 rounded-full transition-all', viewMode === 'card' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground']"
              :title="t.notesCardView"
              @click="setViewMode('card')"
            >
              <LayoutGrid class="size-4.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :class="['size-10 rounded-full transition-all', viewMode === 'list' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground']"
              :title="t.notesListView"
              @click="setViewMode('list')"
            >
              <ListIcon class="size-4.5" />
            </Button>
          </div>

          <!-- Filter categories (if at root) -->
          <DropdownMenu v-if="!activeProjectId">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" class="h-12 px-4 rounded-full text-sm font-medium gap-2 bg-card border-border/80">
                <Folder class="size-4 text-primary" />
                <span class="hidden sm:inline">{{ t.notesLocationCol }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48 rounded-xl shadow-lg">
              <DropdownMenuItem class="cursor-pointer text-xs" @click="activeProjectId = null">
                {{ t.notesAll }}
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer text-xs" @click="activeProjectId = 'pinned'">
                {{ t.notesPinned }}
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer text-xs" @click="activeProjectId = 'standalone'">
                {{ t.notesStandalone }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Primary CTA Button with Dropdown (+ สร้าง) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button class="h-12 px-5 sm:px-6 rounded-full text-sm sm:text-base font-semibold shadow-sm gap-2">
                <Plus class="size-5" />
                <span>{{ t.notesAdd }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52 rounded-xl shadow-lg">
              <DropdownMenuItem class="cursor-pointer gap-2 py-2.5 font-medium" @click="handleCreateNote">
                <FileText class="size-4 text-primary" />
                <span>{{ t.notesNewNote }}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="cursor-pointer gap-2 py-2.5 font-medium" @click="handleCreateProject">
                <FolderPlus class="size-4 text-primary" />
                <span>{{ t.notesNewProject }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- 3. PROJECT DRILLDOWN BREADCRUMB & HEADER -->
      <div v-if="currentProject" class="mb-6 space-y-4">
        <!-- Breadcrumb back link -->
        <div class="flex items-center justify-between">
          <Button variant="ghost" size="sm" class="h-9 px-3 rounded-full text-xs font-semibold gap-1.5" @click="handleBackToRoot">
            <ArrowLeft class="size-3.5" />
            <span>ย้อนกลับไป {{ t.notesAll }}</span>
          </Button>

          <!-- Toggle folder mode presentation (Cover vs Minimal) -->
          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground"
            @click="setFolderViewStyle(folderViewStyle === 'cover' ? 'minimal' : 'cover')"
          >
            {{ folderViewStyle === 'cover' ? t.notesFolderMinimalView : t.notesFolderCoverView }}
          </Button>
        </div>

        <!-- Project Banner Card -->
        <div class="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-4">
            <div class="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <FolderKanban class="size-7" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl sm:text-2xl font-bold text-foreground">{{ currentProject.title }}</h2>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                  {{ filteredNotes.length }} โน้ต
                </span>
              </div>
              <p v-if="currentProject.description" class="text-sm text-muted-foreground mt-1">
                {{ currentProject.description }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" class="h-9 rounded-xl text-xs" @click="handleEditProject(currentProject)">
              {{ t.notesEditProject }}
            </Button>
            <Button size="sm" class="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5" @click="handleCreateNote">
              <Plus class="size-3.5" />
              <span>เพิ่มโน้ตในนี้</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- 4. ROOT PROJECTS SECTION (When at root view & has projects) -->
      <div v-if="!activeProjectId && visibleProjects.length > 0" class="mb-8 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <Folder class="size-4 text-primary" />
            <span>{{ t.notesProjects }}</span>
            <span class="text-xs text-muted-foreground">({{ visibleProjects.length }})</span>
          </h2>

          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            @click="setFolderViewStyle(folderViewStyle === 'cover' ? 'minimal' : 'cover')"
          >
            {{ folderViewStyle === 'cover' ? t.notesFolderMinimalView : t.notesFolderCoverView }}
          </Button>
        </div>

        <div :class="folderViewStyle === 'minimal' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'">
          <ProjectCard
            v-for="proj in visibleProjects"
            :key="proj.id"
            :project="proj"
            :note-count="projectNoteCounts.get(proj.id) || 0"
            :folder-style="folderViewStyle"
            @open="handleOpenProject"
            @edit="handleEditProject"
            @delete="confirmDeleteProject"
          />
        </div>
      </div>

      <!-- 5. NOTES CONTENT (Card View vs Google Drive List View) -->
      <main class="flex-1 space-y-3">
        <div v-if="!activeProjectId" class="flex items-center justify-between mb-2">
          <h2 class="text-base font-bold text-foreground flex items-center gap-2">
            <FileText class="size-4 text-primary" />
            <span>{{ t.notes }}</span>
            <span class="text-xs text-muted-foreground">({{ filteredNotes.length }})</span>
          </h2>
        </div>

        <!-- Loading State -->
        <div v-if="loading && notes.length === 0" class="py-20 text-center space-y-3">
          <div class="size-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p class="text-sm text-muted-foreground">{{ t.checkingSession }}</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredNotes.length === 0 && (!visibleProjects.length || activeProjectId)"
          class="py-20 text-center space-y-4 rounded-3xl border border-dashed border-border/80 bg-card/40"
        >
          <div class="size-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <FileText class="size-8" />
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-foreground">{{ t.notesEmpty }}</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {{ t.notesEmptyHint }}
            </p>
          </div>
          <Button class="h-11 px-5 rounded-full text-sm font-semibold shadow-xs" @click="handleCreateNote">
            <Plus class="size-4 mr-1.5" />
            <span>{{ t.notesNewNote }}</span>
          </Button>
        </div>

        <!-- VIEW 1: Card Grid View (3 columns desktop matching Manga) -->
        <div
          v-else-if="viewMode === 'card'"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8"
        >
          <NoteCard
            v-for="note in filteredNotes"
            :key="note.id"
            :note="note"
            :project-name="projects.find(p => p.id === note.projectId)?.title"
            @open="handleOpenNote"
            @pin="togglePin"
            @delete="confirmDeleteNote"
            @export="handleExportNote"
          />
        </div>

        <!-- VIEW 2: Google Drive-style List View -->
        <div
          v-else
          class="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs divide-y divide-border/60"
        >
          <!-- Table Header Row -->
          <div class="flex items-center justify-between px-4 py-3 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div class="flex-1 pr-4">{{ t.notesNameCol }}</div>
            <div class="hidden sm:block w-36">{{ t.notesLocationCol }}</div>
            <div class="hidden md:block w-24 text-right">{{ t.notesSizeCol }}</div>
            <div class="hidden sm:block w-28 text-right">{{ t.notesModifiedDate }}</div>
            <div class="w-24 text-right">{{ t.notesActionsCol }}</div>
          </div>

          <!-- Table Body Rows -->
          <NoteListItem
            v-for="(note, index) in filteredNotes"
            :key="note.id"
            :note="note"
            :project-name="projects.find(p => p.id === note.projectId)?.title"
            :can-reorder="Boolean(activeProjectId)"
            :is-first="index === 0"
            :is-last="index === filteredNotes.length - 1"
            @open="handleOpenNote"
            @pin="togglePin"
            @delete="confirmDeleteNote"
            @move-up="(id) => handleMoveNote(id, 'up')"
            @move-down="(id) => handleMoveNote(id, 'down')"
            @export="handleExportNote"
          />
        </div>
      </main>

      <!-- 6. MODALS & DIALOGS -->
      <!-- Note Editor Dialog (Apple Notes Parity) -->
      <NoteEditorDialog
        :open="noteEditorOpen"
        :note="currentNote"
        :projects="projects"
        :saving="saving"
        :save-status="saveStatus"
        :last-saved-at="lastSavedAt"
        @update:open="(val) => { noteEditorOpen = val; if (!val) cancelPendingSave(); }"
        @save="saveNote"
        @auto-save="queueDebouncedSave"
        @cancel-save="cancelPendingSave"
        @export="exportNote"
      />

      <!-- Project Folder Editor Dialog -->
      <ProjectEditorDialog
        :open="projectEditorOpen"
        :project="editingProject"
        :saving="saving"
        @update:open="(val) => projectEditorOpen = val"
        @save="handleSaveProject"
      />

      <!-- Delete Confirmation Modal -->
      <AlertDialog :open="deleteAlertOpen" @update:open="(val) => deleteAlertOpen = val">
        <AlertDialogContent class="sm:max-w-md p-6 sm:p-7 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle class="text-lg font-bold">
              {{ itemToDelete?.type === 'project' ? t.notesDeleteProject : t.notesDeleteNote }}
            </AlertDialogTitle>
            <AlertDialogDescription class="text-sm">
              {{ itemToDelete?.type === 'project' ? t.notesDeleteProjectConfirm : t.notesDeleteNoteConfirm }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter class="pt-4 gap-2">
            <AlertDialogCancel class="rounded-xl">{{ t.cancel }}</AlertDialogCancel>
            <AlertDialogAction
              class="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              @click="handleConfirmDelete"
            >
              {{ t.delete }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <!-- Login Warning Modal -->
      <AlertDialog :open="showLoginAlert" @update:open="(val) => showLoginAlert = val">
        <AlertDialogContent class="sm:max-w-md p-6 sm:p-7 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle class="text-lg font-bold">จำเป็นต้องเข้าสู่ระบบ</AlertDialogTitle>
            <AlertDialogDescription class="text-sm">
              ฟีเจอร์ Note ถูกจัดเก็บใน Cloudflare KV ส่วนตัวอย่างปลอดภัย กรุณา Login เพื่อสร้างและแก้ไขข้อมูล
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter class="pt-4 gap-2">
            <AlertDialogCancel class="rounded-xl">{{ t.cancel }}</AlertDialogCancel>
            <AlertDialogAction as-child class="rounded-xl">
              <RouterLink to="/settings">{{ t.login }}</RouterLink>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</template>
