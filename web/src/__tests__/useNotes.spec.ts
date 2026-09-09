import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotes } from '@/composables/useNotes'

describe('useNotes composable', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('initializes with default view settings and empty collections', () => {
    const { viewMode, folderViewStyle, notes, projects } = useNotes()
    expect(viewMode.value).toBe('card')
    expect(folderViewStyle.value).toBe('cover')
    expect(notes.value).toEqual([])
    expect(projects.value).toEqual([])
  })

  it('updates viewMode and folderViewStyle with localStorage persistence', () => {
    const { viewMode, folderViewStyle, setViewMode, setFolderViewStyle } = useNotes()

    setViewMode('list')
    expect(viewMode.value).toBe('list')
    expect(localStorage.getItem('smarttools-notes-viewmode')).toBe('list')

    setFolderViewStyle('minimal')
    expect(folderViewStyle.value).toBe('minimal')
    expect(localStorage.getItem('smarttools-notes-folderstyle')).toBe('minimal')
  })

  it('exports note correctly to Markdown, HTML, and Text formats', () => {
    const { exportNote } = useNotes()

    const mockNote = {
      id: 'note_1',
      title: 'Meeting Notes',
      content: '<h1>Title</h1><p>Discussing <strong>roadmap</strong></p><ul><li>Item 1</li></ul>',
      snippet: 'Discussing roadmap',
      projectId: null,
      pinned: false,
      order: 0,
      wordCount: 3,
      charCount: 25,
      createdAt: '2026-09-09T00:00:00Z',
      updatedAt: '2026-09-09T00:00:00Z',
    }

    // Mock URL and click
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    exportNote(mockNote, 'md')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    exportNote(mockNote, 'html')
    expect(clickSpy).toHaveBeenCalledTimes(2)

    exportNote(mockNote, 'txt')
    expect(clickSpy).toHaveBeenCalledTimes(3)
  })
})
