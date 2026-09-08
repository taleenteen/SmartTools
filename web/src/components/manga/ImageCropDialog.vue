<script setup lang="ts">
import { RotateCcw, ZoomIn, ZoomOut } from '@lucide/vue'
import { nextTick, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { t } from '@/i18n/th'

const props = defineProps<{
  open: boolean
  imageSrc: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'crop', dataUrl: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const loadedImage = ref<HTMLImageElement | null>(null)

// Target aspect ratio 2:3 (e.g. 260 x 390 in canvas preview)
const PREVIEW_WIDTH = 260
const PREVIEW_HEIGHT = 390
const OUTPUT_WIDTH = 320
const OUTPUT_HEIGHT = 480

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.imageSrc) {
      loadImage(props.imageSrc)
    }
  },
)

watch(
  () => props.imageSrc,
  (newSrc) => {
    if (props.open && newSrc) {
      loadImage(newSrc)
    }
  },
)

function loadImage(src: string) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    loadedImage.value = img
    resetCrop()
    void nextTick(() => draw())
  }
  img.src = src
}

function resetCrop() {
  if (!loadedImage.value) return
  const img = loadedImage.value

  // Fit image to cover the 2:3 preview box initially
  const scaleX = PREVIEW_WIDTH / img.width
  const scaleY = PREVIEW_HEIGHT / img.height
  const baseScale = Math.max(scaleX, scaleY)

  zoom.value = 1
  offsetX.value = (PREVIEW_WIDTH - img.width * baseScale) / 2
  offsetY.value = (PREVIEW_HEIGHT - img.height * baseScale) / 2
  draw()
}

function getBaseScale(): number {
  if (!loadedImage.value) return 1
  const img = loadedImage.value
  const scaleX = PREVIEW_WIDTH / img.width
  const scaleY = PREVIEW_HEIGHT / img.height
  return Math.max(scaleX, scaleY)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !loadedImage.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

  const img = loadedImage.value
  const baseScale = getBaseScale()
  const currentScale = baseScale * zoom.value

  const w = img.width * currentScale
  const h = img.height * currentScale

  ctx.drawImage(img, offsetX.value, offsetY.value, w, h)
}

function onPointerDown(e: PointerEvent) {
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - offsetX.value,
    y: e.clientY - offsetY.value,
  }
  ;(e.target as HTMLElement)?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  offsetX.value = e.clientX - dragStart.value.x
  offsetY.value = e.clientY - dragStart.value.y
  draw()
}

function onPointerUp(e: PointerEvent) {
  isDragging.value = false
  try {
    ;(e.target as HTMLElement)?.releasePointerCapture(e.pointerId)
  } catch {
    // Ignore if not captured
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.05 : 0.05
  setZoom(zoom.value + delta)
}

function setZoom(val: number) {
  const oldZoom = zoom.value
  const newZoom = Math.min(3, Math.max(0.6, val))
  if (oldZoom === newZoom) return

  // Zoom towards center of canvas
  const centerX = PREVIEW_WIDTH / 2
  const centerY = PREVIEW_HEIGHT / 2

  const baseScale = getBaseScale()
  const oldScale = baseScale * oldZoom
  const newScale = baseScale * newZoom

  const ratio = newScale / oldScale
  offsetX.value = centerX - (centerX - offsetX.value) * ratio
  offsetY.value = centerY - (centerY - offsetY.value) * ratio
  zoom.value = newZoom

  draw()
}

function handleConfirm() {
  if (!loadedImage.value) return

  const offscreen = document.createElement('canvas')
  offscreen.width = OUTPUT_WIDTH
  offscreen.height = OUTPUT_HEIGHT
  const offCtx = offscreen.getContext('2d')
  if (!offCtx) return

  // Ratio between preview and output
  const scaleRatio = OUTPUT_WIDTH / PREVIEW_WIDTH
  const img = loadedImage.value
  const baseScale = getBaseScale()
  const currentScale = baseScale * zoom.value * scaleRatio

  offCtx.drawImage(
    img,
    offsetX.value * scaleRatio,
    offsetY.value * scaleRatio,
    img.width * currentScale,
    img.height * currentScale,
  )

  let dataUrl = ''
  try {
    dataUrl = offscreen.toDataURL('image/webp', 0.85)
  } catch {
    dataUrl = offscreen.toDataURL('image/jpeg', 0.85)
  }

  emit('crop', dataUrl)
  emit('update:open', false)
}

onMounted(() => {
  if (props.open && props.imageSrc) {
    loadImage(props.imageSrc)
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="(val: boolean) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md p-6">
      <DialogHeader>
        <DialogTitle class="text-lg font-semibold tracking-tight">
          {{ t.mangaCropTitle }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-col items-center gap-4 py-2">
        <!-- Canvas Viewport -->
        <div
          class="relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 shadow-inner select-none cursor-grab active:cursor-grabbing"
          :style="{ width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px` }"
          @wheel="onWheel"
        >
          <canvas
            ref="canvasRef"
            :width="PREVIEW_WIDTH"
            :height="PREVIEW_HEIGHT"
            class="block touch-none"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />

          <!-- Crop guideline overlay -->
          <div class="pointer-events-none absolute inset-0 border border-primary/40 rounded-xl" />
        </div>

        <!-- Zoom and reset controls -->
        <div class="flex w-full max-w-xs items-center justify-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            type="button"
            :title="t.showLess"
            @click="setZoom(zoom - 0.1)"
          >
            <ZoomOut class="size-4" />
          </Button>

          <input
            v-model.number="zoom"
            type="range"
            min="0.6"
            max="3"
            step="0.05"
            class="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            @input="setZoom(zoom)"
          />

          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            type="button"
            :title="t.showMore"
            @click="setZoom(zoom + 0.1)"
          >
            <ZoomIn class="size-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            class="size-8 text-muted-foreground hover:text-foreground"
            type="button"
            :title="t.retry"
            @click="resetCrop"
          >
            <RotateCcw class="size-4" />
          </Button>
        </div>
      </div>

      <DialogFooter class="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" type="button" @click="emit('update:open', false)">
          {{ t.cancel }}
        </Button>
        <Button type="button" @click="handleConfirm">
          {{ t.mangaCropConfirm }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
