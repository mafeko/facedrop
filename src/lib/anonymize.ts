import { detectFacesMultiScale } from './multiScaleDetect'
import type { AnonymizeMethod, Box, ProcessedImage } from '../types'

export interface AnonymizeOptions {
  method: AnonymizeMethod
  /** Extra margin around each detected face, as a fraction of its size. */
  padding: number
}

export const DEFAULT_ANONYMIZE_OPTIONS: AnonymizeOptions = {
  method: 'pixelate',
  padding: 0.35,
}

export async function anonymizeImage(file: File, options: AnonymizeOptions): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const faces = await detectFacesMultiScale(bitmap)
    return renderAnonymized(bitmap, file, faces.map((face) => face.box), options)
  } finally {
    bitmap.close()
  }
}

/**
 * Re-renders an already-detected set of face boxes with a (possibly different) effect,
 * without re-running face detection. Used when the user switches pixelate ↔ blur after
 * a batch has already been processed.
 */
export async function reapplyEffect(
  file: File,
  faceBoxes: Box[],
  options: AnonymizeOptions,
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    return renderAnonymized(bitmap, file, faceBoxes, options)
  } finally {
    bitmap.close()
  }
}

function renderAnonymized(
  bitmap: ImageBitmap,
  file: File,
  faceBoxes: Box[],
  options: AnonymizeOptions,
): Promise<ProcessedImage> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = getContext(canvas)
  ctx.drawImage(bitmap, 0, 0)

  for (const faceBox of faceBoxes) {
    const box = padBox(faceBox, options.padding, canvas.width, canvas.height)
    if (options.method === 'pixelate') {
      pixelateRegion(ctx, bitmap, box)
    } else {
      blurRegion(ctx, bitmap, box)
    }
  }

  return canvasToBlob(canvas, file.type).then((blob) => ({
    fileName: buildOutputFileName(file.name),
    blob,
    url: URL.createObjectURL(blob),
    faceCount: faceBoxes.length,
    faceBoxes,
  }))
}

export function padBox(box: Box, padding: number, maxWidth: number, maxHeight: number): Box {
  const padX = box.width * padding
  // A bit of extra headroom above the box, since face detectors tend to crop
  // foreheads/hair tightly.
  const padTop = box.height * padding * 1.6
  const padBottom = box.height * padding

  const x = clamp(box.x - padX, 0, maxWidth)
  const y = clamp(box.y - padTop, 0, maxHeight)
  const right = clamp(box.x + box.width + padX, 0, maxWidth)
  const bottom = clamp(box.y + box.height + padBottom, 0, maxHeight)

  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function pixelateRegion(ctx: CanvasRenderingContext2D, source: CanvasImageSource, box: Box) {
  const blockSize = Math.max(6, Math.round(Math.min(box.width, box.height) / 12))
  const smallWidth = Math.max(1, Math.round(box.width / blockSize))
  const smallHeight = Math.max(1, Math.round(box.height / blockSize))

  const small = document.createElement('canvas')
  small.width = smallWidth
  small.height = smallHeight
  const smallCtx = getContext(small)
  smallCtx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, smallWidth, smallHeight)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, 0, 0, smallWidth, smallHeight, box.x, box.y, box.width, box.height)
  ctx.restore()
}

function blurRegion(ctx: CanvasRenderingContext2D, source: CanvasImageSource, box: Box) {
  const radius = Math.max(8, Math.round(Math.min(box.width, box.height) / 4))
  const sx = box.x - radius
  const sy = box.y - radius
  const sw = box.width + radius * 2
  const sh = box.height + radius * 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(box.x, box.y, box.width, box.height)
  ctx.clip()
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh)
  ctx.restore()
}

function canvasToBlob(canvas: HTMLCanvasElement, sourceType: string): Promise<Blob> {
  const type = sourceType === 'image/png' ? 'image/png' : 'image/jpeg'
  const quality = type === 'image/jpeg' ? 0.92 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      type,
      quality,
    )
  })
}

export function buildOutputFileName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf('.')
  const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName
  const ext = originalName.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
  return `${base}-anonymisiert.${ext}`
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.')
  return ctx
}
