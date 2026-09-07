export type CardType = 'simple' | 'desc-clickable' | 'expandable'
export type SectionKind = 'card' | 'email' | 'contact'
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SubCard {
  id?: string
  icon?: string
  iconImg?: string
  title?: string
  desc?: string
  content?: string
  note?: string
  url?: string
  isLocal?: boolean
  comment?: string
}

export interface BookmarkCard {
  id?: string
  type?: CardType
  icon?: string
  iconImg?: string
  title?: string
  desc?: string
  descClickable?: string
  descUrl?: string
  url?: string
  isLocal?: boolean
  comment?: string
  address?: string
  mailto?: string
  subCards?: SubCard[]
  pushedBy?: string
  pushedAt?: string
}

export interface EncEnvelope {
  v?: number
  alg?: string
  iter?: number
  salt?: string
  iv?: string
  data?: string
}

export interface BookmarkSection {
  key: string
  kind: SectionKind
  label: string
  builtin: boolean
  visible: boolean
  dynamic: boolean
  encrypted?: boolean
  enc?: EncEnvelope | null
  anchor?: string
  cards: BookmarkCard[]
}

export interface DataMeta {
  version?: string
  updatedAt?: string
  source?: string
}

export interface ViewerInfo {
  isAdminView: boolean
  slug?: string
  username?: string
  role?: string
}

export const BUILTIN_DYNAMIC: Record<string, boolean> = {
  onlineAIData: true,
  videoData: true,
}
