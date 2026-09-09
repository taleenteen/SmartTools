export interface NoteProject {
  id: string
  title: string
  description?: string
  coverUrl?: string
  color?: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface NoteItemSummary {
  id: string
  title: string
  snippet: string
  coverUrl?: string
  projectId?: string | null
  pinned?: boolean
  order: number
  wordCount: number
  charCount: number
  createdAt: string
  updatedAt: string
}

export interface NoteItemFull extends NoteItemSummary {
  content: string
}

export interface NotesIndex {
  projects: NoteProject[]
  notes: NoteItemSummary[]
}

export type NoteViewMode = 'card' | 'list'
export type NoteFolderViewStyle = 'cover' | 'minimal'
export type NoteFilterTab = 'all' | 'standalone' | 'pinned' | string
