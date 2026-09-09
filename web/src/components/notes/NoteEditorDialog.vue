<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { t } from '@/i18n/th'
import type { NoteItemFull, NoteProject } from '@/types/note'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  Maximize2,
  Minimize2,
  Download,
  Search,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Type,
  Folder,
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  note: NoteItemFull | null
  projects: NoteProject[]
  saving?: boolean
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error' | 'unsaved'
  lastSavedAt?: Date | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', note: Partial<NoteItemFull>): void
  (e: 'auto-save', note: Partial<NoteItemFull>): void
  (e: 'export', note: NoteItemFull, format: 'md' | 'html' | 'txt'): void
}>()

// Note metadata fields
const title = ref('')
const projectId = ref<string | null>(null)
const coverUrl = ref('')
const showCoverInput = ref(false)
const isZenMode = ref(false)

// Typography customizer
const selectedFont = ref('font-sans')
const selectedSize = ref('prose-base')

const fontOptions = [
  { id: 'font-sans', name: 'Sans-Serif (ค่าเริ่มต้น)' },
  { id: 'font-serif', name: 'Classical Serif' },
  { id: 'font-mono', name: 'Monospace (โค้ด)' },
  { id: 'font-prompt', name: 'Prompt (โมเดิร์น ไร้หัว)' },
  { id: 'font-sarabun', name: 'Sarabun (ทางการ มีหัว)' },
]

const sizeOptions = [
  { id: 'prose-sm', name: 'ขนาดเล็ก (Small)' },
  { id: 'prose-base', name: 'ปกติ (Normal)' },
  { id: 'prose-lg', name: 'ขนาดใหญ่ (Large)' },
  { id: 'prose-xl', name: 'ใหญ่พิเศษ (Extra Large)' },
]

// Find and Replace toolbar
const showFindReplace = ref(false)
const findText = ref('')
const replaceText = ref('')

// Initialize Tiptap Editor
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false, // will use formatted code block
    }),
    Underline,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Link.configure({ openOnClick: false }),
    Image.configure({ inline: true, allowBase64: true }),
    Placeholder.configure({
      placeholder: t.notesContentPlaceholder,
    }),
    CharacterCount,
  ],
  content: '',
  onUpdate: () => {
    triggerAutoSave()
  },
})

// Synchronize prop note with local state
watch(
  () => props.note,
  (newNote) => {
    if (newNote) {
      title.value = newNote.title || ''
      projectId.value = newNote.projectId || null
      coverUrl.value = newNote.coverUrl || ''
      showCoverInput.value = Boolean(newNote.coverUrl)
      if (editor.value && editor.value.getHTML() !== newNote.content) {
        editor.value.commands.setContent(newNote.content || '')
      }
    } else {
      title.value = ''
      projectId.value = null
      coverUrl.value = ''
      showCoverInput.value = false
      if (editor.value) editor.value.commands.setContent('')
    }
  },
  { immediate: true }
)

// Re-sync when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.note && editor.value) {
      if (editor.value.getHTML() !== props.note.content) {
        editor.value.commands.setContent(props.note.content || '')
      }
    }
  }
)

function getNotePayload(): Partial<NoteItemFull> {
  const html = editor.value ? editor.value.getHTML() : ''
  const words = editor.value ? editor.value.storage.characterCount.words() : 0
  const chars = editor.value ? editor.value.storage.characterCount.characters() : 0

  return {
    id: props.note?.id,
    title: title.value.trim() || 'Untitled Note',
    content: html,
    projectId: projectId.value,
    coverUrl: coverUrl.value.trim(),
    pinned: props.note?.pinned,
    order: props.note?.order,
    wordCount: words,
    charCount: chars,
  }
}

function triggerAutoSave() {
  emit('auto-save', getNotePayload())
}

function handleManualSave() {
  emit('save', getNotePayload())
}

// Find & Replace actions
function handleFindNext() {
  if (!findText.value.trim() || !editor.value) return
  // Find in text using browser selection or custom matcher
  const content = editor.value.getText()
  const idx = content.toLowerCase().indexOf(findText.value.toLowerCase())
  if (idx >= 0) {
    editor.value.commands.setTextSelection({ from: idx + 1, to: idx + 1 + findText.value.length })
  }
}

function handleReplace() {
  if (!findText.value.trim() || !editor.value) return
  const { from, to } = editor.value.state.selection
  const selected = editor.value.state.doc.textBetween(from, to)
  if (selected.toLowerCase() === findText.value.toLowerCase()) {
    editor.value.commands.insertContent(replaceText.value)
  }
  handleFindNext()
}

function handleReplaceAll() {
  if (!findText.value.trim() || !editor.value) return
  const html = editor.value.getHTML()
  const regex = new RegExp(findText.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const newHtml = html.replace(regex, replaceText.value)
  editor.value.commands.setContent(newHtml)
  triggerAutoSave()
}

// Keyboard shortcuts (Ctrl+S / Cmd+S to save, Ctrl+F for search)
function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleManualSave()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    showFindReplace.value = !showFindReplace.value
  }
}

// Stats computed
const wordsCount = computed(() => (editor.value ? editor.value.storage.characterCount.words() : 0))
const charsCount = computed(() => (editor.value ? editor.value.storage.characterCount.characters() : 0))
const readingTimeMinutes = computed(() => Math.max(1, Math.ceil(wordsCount.value / 200)))

// Save status format
const saveLabel = computed(() => {
  if (props.saveStatus === 'saving') return t.notesSaving
  if (props.saveStatus === 'unsaved') return t.notesUnsaved
  if (props.saveStatus === 'error') return 'บันทึกไม่สำเร็จ'
  if (props.lastSavedAt) {
    return `${t.notesSaved} ${props.lastSavedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
  }
  return t.notesSaved
})

function handlePrint() {
  if (typeof window !== 'undefined') window.print()
}

function handleInsertLink() {
  if (typeof window === 'undefined') return
  const url = window.prompt('ใส่ URL ลิงก์:')
  if (url && editor.value) {
    editor.value.chain().focus().setLink({ href: url }).run()
  }
}

function handleInsertImage() {
  if (typeof window === 'undefined') return
  const url = window.prompt('ใส่ URL รูปภาพ:')
  if (url && editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run()
  }
}

onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy()
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent
      :class="[
        'p-0 gap-0 overflow-hidden flex flex-col transition-all duration-200 border border-border shadow-2xl bg-card',
        isZenMode ? 'fixed inset-0 w-screen h-screen max-w-none rounded-none' : 'w-[96vw] max-w-5xl h-[92vh] rounded-2xl'
      ]"
      @keydown="handleKeyDown"
    >
      <!-- 1. TOP HEADER & WORKSPACE BAR -->
      <header class="px-5 py-3 border-b border-border/70 flex items-center justify-between gap-3 bg-card shrink-0">
        <!-- Breadcrumb & Project Selector -->
        <div class="flex items-center gap-2 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="sm" class="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground">
                <Folder class="size-3.5 text-primary" />
                <span class="truncate max-w-[150px]">
                  {{ projects.find(p => p.id === projectId)?.title || t.notesStandalone }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-56 rounded-xl shadow-lg">
              <DropdownMenuItem class="cursor-pointer text-xs" @click="projectId = null; triggerAutoSave()">
                {{ t.notesStandalone }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                v-for="p in projects"
                :key="p.id"
                class="cursor-pointer text-xs gap-2"
                @click="projectId = p.id; triggerAutoSave()"
              >
                <span>📁 {{ p.title }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Status Indicator Pill -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground">
            <Loader2 v-if="saveStatus === 'saving'" class="size-3 animate-spin text-primary" />
            <CheckCircle2 v-else-if="saveStatus === 'saved'" class="size-3 text-emerald-500" />
            <span v-else-if="saveStatus === 'unsaved'" class="size-2 rounded-full bg-amber-500" />
            <AlertCircle v-else-if="saveStatus === 'error'" class="size-3 text-destructive" />
            <span>{{ saveLabel }}</span>
          </div>
        </div>

        <!-- Header Actions: Font Picker, Find, Export, Zen, Save -->
        <div class="flex items-center gap-1.5">
          <!-- Font Family & Size Picker (Mac Pain Point Solution!) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="sm" class="h-8 px-2.5 rounded-lg text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <Type class="size-3.5" />
                <span class="hidden sm:inline">{{ t.notesFont }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52 rounded-xl shadow-lg">
              <div class="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {{ t.notesFont }}
              </div>
              <DropdownMenuItem
                v-for="f in fontOptions"
                :key="f.id"
                :class="['cursor-pointer text-xs justify-between', selectedFont === f.id ? 'font-bold text-primary' : '']"
                @click="selectedFont = f.id"
              >
                <span>{{ f.name }}</span>
                <span v-if="selectedFont === f.id">✓</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <div class="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {{ t.notesFontSize }}
              </div>
              <DropdownMenuItem
                v-for="s in sizeOptions"
                :key="s.id"
                :class="['cursor-pointer text-xs justify-between', selectedSize === s.id ? 'font-bold text-primary' : '']"
                @click="selectedSize = s.id"
              >
                <span>{{ s.name }}</span>
                <span v-if="selectedSize === s.id">✓</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Find & Replace Toggle -->
          <Button
            variant="ghost"
            size="icon"
            :class="['size-8 rounded-lg text-muted-foreground hover:text-foreground', showFindReplace ? 'bg-muted text-primary' : '']"
            title="ค้นหาและแทนที่ (Ctrl+F)"
            @click="showFindReplace = !showFindReplace"
          >
            <Search class="size-4" />
          </Button>

          <!-- Export Dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="sm" class="h-8 px-2 rounded-lg text-xs gap-1 text-muted-foreground hover:text-foreground" :title="t.notesExport">
                <Download class="size-3.5" />
                <span class="hidden sm:inline">{{ t.notesExport }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48 rounded-xl shadow-lg">
              <DropdownMenuItem class="cursor-pointer text-xs" @click="props.note && emit('export', props.note, 'md')">
                {{ t.notesExportMd }}
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer text-xs" @click="props.note && emit('export', props.note, 'html')">
                {{ t.notesExportHtml }}
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer text-xs" @click="props.note && emit('export', props.note, 'txt')">
                {{ t.notesExportTxt }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="cursor-pointer text-xs" @click="handlePrint()">
                {{ t.notesExportPrint }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Zen Mode Toggle -->
          <Button
            variant="ghost"
            size="icon"
            class="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            :title="isZenMode ? 'ออกจากโหมดเต็มจอ' : 'โหมดเต็มจอ (Zen Mode)'"
            @click="isZenMode = !isZenMode"
          >
            <Minimize2 v-if="isZenMode" class="size-4" />
            <Maximize2 v-else class="size-4" />
          </Button>

          <!-- Instant Save Button -->
          <Button
            class="h-8 px-3 rounded-lg text-xs font-semibold shadow-xs gap-1.5"
            :disabled="saving"
            @click="handleManualSave"
          >
            <Save class="size-3.5" />
            <span>{{ t.notesSave }}</span>
          </Button>

          <!-- Close Modal -->
          <Button
            variant="ghost"
            size="icon"
            class="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            @click="emit('update:open', false)"
          >
            <X class="size-4" />
          </Button>
        </div>
      </header>

      <!-- 2. FIND & REPLACE BAR (Toggleable) -->
      <div v-if="showFindReplace" class="px-5 py-2.5 bg-muted/40 border-b border-border/60 flex flex-wrap items-center gap-2 text-xs shrink-0">
        <div class="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Input
            v-model="findText"
            :placeholder="t.notesFind"
            class="h-8 text-xs rounded-lg bg-background"
            @keydown.enter="handleFindNext"
          />
          <Input
            v-model="replaceText"
            :placeholder="t.notesReplace"
            class="h-8 text-xs rounded-lg bg-background"
          />
        </div>
        <div class="flex items-center gap-1">
          <Button variant="secondary" size="sm" class="h-8 px-2.5 rounded-lg text-xs" @click="handleFindNext">
            ค้นหา
          </Button>
          <Button variant="secondary" size="sm" class="h-8 px-2.5 rounded-lg text-xs" @click="handleReplace">
            {{ t.notesReplaceBtn }}
          </Button>
          <Button variant="secondary" size="sm" class="h-8 px-2.5 rounded-lg text-xs" @click="handleReplaceAll">
            {{ t.notesReplaceAllBtn }}
          </Button>
          <Button variant="ghost" size="icon" class="size-8 rounded-lg" @click="showFindReplace = false">
            <X class="size-3.5" />
          </Button>
        </div>
      </div>

      <!-- 3. APPLE NOTES FORMATTING TOOLBAR -->
      <div v-if="editor" class="px-4 py-2 border-b border-border/70 flex items-center gap-1 overflow-x-auto bg-card shrink-0 select-none">
        <!-- Headings / Paragraphs -->
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('paragraph') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Body Paragraph"
          @click="editor.chain().focus().setParagraph().run()"
        >
          <Pilcrow class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('heading', { level: 1 }) ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Title (H1)"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <Heading1 class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('heading', { level: 2 }) ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Heading (H2)"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Heading2 class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('heading', { level: 3 }) ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Subheading (H3)"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <Heading3 class="size-4" />
        </Button>

        <div class="w-px h-5 bg-border mx-1" />

        <!-- Inline Formatting -->
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('bold') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Bold (Ctrl+B)"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('italic') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Italic (Ctrl+I)"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('underline') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Underline (Ctrl+U)"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <UnderlineIcon class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('strike') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Strikethrough"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Strikethrough class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('highlight') ? 'bg-muted text-amber-500' : 'text-muted-foreground']"
          title="Highlighter"
          @click="editor.chain().focus().toggleHighlight().run()"
        >
          <Highlighter class="size-4" />
        </Button>

        <div class="w-px h-5 bg-border mx-1" />

        <!-- Checklists & Lists -->
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('taskList') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Checklist / To-do"
          @click="editor.chain().focus().toggleTaskList().run()"
        >
          <ListTodo class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('bulletList') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Bullet List"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <List class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('orderedList') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Numbered List"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <ListOrdered class="size-4" />
        </Button>

        <div class="w-px h-5 bg-border mx-1" />

        <!-- Structure: Quote, Code block, Table -->
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('blockquote') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Quote Block"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Quote class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg', editor.isActive('codeBlock') ? 'bg-muted text-primary' : 'text-muted-foreground']"
          title="Code Block"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Code class="size-4" />
        </Button>

        <!-- Table Dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="['size-8 rounded-lg', editor.isActive('table') ? 'bg-muted text-primary' : 'text-muted-foreground']"
              title="Table"
            >
              <TableIcon class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-48 rounded-xl shadow-lg">
            <DropdownMenuItem class="cursor-pointer text-xs" @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
              สร้างตาราง (3x3)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem :disabled="!editor.isActive('table')" class="cursor-pointer text-xs" @click="editor.chain().focus().addRowAfter().run()">
              เพิ่มแถว (Add Row)
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!editor.isActive('table')" class="cursor-pointer text-xs" @click="editor.chain().focus().addColumnAfter().run()">
              เพิ่มคอลัมน์ (Add Column)
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!editor.isActive('table')" class="cursor-pointer text-xs text-destructive" @click="editor.chain().focus().deleteRow().run()">
              ลบแถว
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!editor.isActive('table')" class="cursor-pointer text-xs text-destructive" @click="editor.chain().focus().deleteColumn().run()">
              ลบคอลัมน์
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!editor.isActive('table')" class="cursor-pointer text-xs text-destructive" @click="editor.chain().focus().deleteTable().run()">
              ลบตารางทั้งหมด
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="w-px h-5 bg-border mx-1" />

        <!-- Media & Links -->
        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          title="ใส่ลิงก์"
          @click="handleInsertLink"
        >
          <Link2 class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          title="ใส่รูปภาพ"
          @click="handleInsertImage"
        >
          <ImageIcon class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :class="['size-8 rounded-lg text-muted-foreground hover:text-foreground', showCoverInput ? 'bg-muted text-primary' : '']"
          title="ตั้งภาพหน้าปกโน้ต (Cover)"
          @click="showCoverInput = !showCoverInput"
        >
          <span class="text-xs font-bold">ปก</span>
        </Button>
      </div>

      <!-- 4. NOTE TITLE & COVER BANNER -->
      <div class="px-8 pt-6 pb-2 shrink-0 space-y-4">
        <!-- Optional Cover Input & Banner -->
        <div v-if="showCoverInput" class="space-y-2">
          <Input
            v-model="coverUrl"
            :placeholder="t.notesCoverPlaceholder"
            class="h-9 text-xs rounded-xl"
            @change="triggerAutoSave"
          />
          <div v-if="coverUrl" class="h-44 w-full rounded-2xl overflow-hidden border border-border bg-muted/40 relative">
            <img :src="coverUrl" class="w-full h-full object-cover" alt="Note Cover Preview" />
            <button
              type="button"
              class="absolute top-3 right-3 size-7 rounded-full bg-background/80 text-muted-foreground hover:text-foreground flex items-center justify-center backdrop-blur-xs"
              @click="coverUrl = ''; showCoverInput = false; triggerAutoSave()"
            >
              <X class="size-4" />
            </button>
          </div>
        </div>

        <!-- Note Title Input -->
        <input
          v-model="title"
          :placeholder="t.notesTitlePlaceholder"
          class="w-full text-2xl sm:text-3xl font-extrabold bg-transparent text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:ring-0 px-0"
          @input="triggerAutoSave"
        />
      </div>

      <!-- 5. EDITOR CONTENT AREA (Tiptap Prose) -->
      <div class="flex-1 overflow-y-auto px-8 py-4 focus:outline-none">
        <EditorContent
          :editor="editor"
          :class="['tiptap-editor max-w-none text-foreground outline-none', selectedFont, selectedSize]"
        />
      </div>

      <!-- 6. LIVE STATUS BAR (Apple Notes Pain Point Fix!) -->
      <footer class="px-6 py-2.5 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground bg-card shrink-0">
        <div class="flex items-center gap-4">
          <span>{{ wordsCount }} {{ t.notesWords }}</span>
          <span>•</span>
          <span>{{ charsCount }} {{ t.notesChars }}</span>
          <span>•</span>
          <span>{{ t.notesReadingTime }} ~{{ readingTimeMinutes }} นาที</span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-[11px] opacity-70">บันทึกอัตโนมัติ (กด Ctrl+S เพื่อบันทึกทันที)</span>
        </div>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<style>
/* Tiptap Custom Styles matching Apple Notes */
.tiptap-editor .tiptap {
  outline: none;
  min-height: 280px;
}

.tiptap-editor .tiptap p.is-editor-empty:first-child::before {
  color: var(--color-muted-foreground, #888);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Headings */
.tiptap-editor .tiptap h1 {
  font-size: 1.875rem;
  font-weight: 800;
  line-height: 1.3;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: var(--color-foreground);
}

.tiptap-editor .tiptap h2 {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.35;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--color-foreground);
}

.tiptap-editor .tiptap h3 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--color-foreground);
}

.tiptap-editor .tiptap p {
  line-height: 1.7;
  margin-bottom: 0.75rem;
}

/* Checklists / To-dos */
.tiptap-editor ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
  margin: 0.75rem 0;
}

.tiptap-editor li[data-type="taskItem"] {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 0.35rem;
}

.tiptap-editor li[data-type="taskItem"] > label {
  user-select: none;
  margin-top: 0.2rem;
  cursor: pointer;
}

.tiptap-editor li[data-type="taskItem"] > label input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 0.35rem;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.tiptap-editor li[data-type="taskItem"][data-checked="true"] > div {
  text-decoration: line-through;
  opacity: 0.6;
}

/* Regular Lists */
.tiptap-editor ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.75rem 0;
}

.tiptap-editor ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.75rem 0;
}

.tiptap-editor li {
  margin-bottom: 0.25rem;
  line-height: 1.6;
}

/* Blockquotes */
.tiptap-editor blockquote {
  border-left: 3px solid var(--color-primary);
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  opacity: 0.85;
}

/* Code block */
.tiptap-editor pre {
  background-color: var(--color-muted);
  border-radius: 0.85rem;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  margin: 1rem 0;
  overflow-x: auto;
  border: 1px solid var(--color-border);
}

.tiptap-editor code {
  background-color: var(--color-muted);
  padding: 0.15rem 0.35rem;
  border-radius: 0.35rem;
  font-size: 0.875em;
  font-family: monospace;
}

/* Tables */
.tiptap-editor table {
  border-collapse: collapse;
  margin: 1rem 0;
  width: 100%;
  table-layout: fixed;
  overflow: hidden;
  border-radius: 0.75rem;
}

.tiptap-editor td,
.tiptap-editor th {
  min-width: 1em;
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
}

.tiptap-editor th {
  font-weight: bold;
  text-align: left;
  background-color: var(--color-muted);
}

/* Highlights */
.tiptap-editor mark {
  background-color: rgba(250, 204, 21, 0.4);
  padding: 0.1rem 0.2rem;
  border-radius: 0.25rem;
}

/* Thai font styles */
.font-prompt {
  font-family: 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif;
}

.font-sarabun {
  font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif;
}
</style>
