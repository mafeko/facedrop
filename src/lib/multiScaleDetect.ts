import { loadFaceApi } from './faceApiModels'
import type { Box } from '../types'

export interface ScoredBox {
  box: Box
  score: number
}

// Detection pipeline: an ensemble of the native browser FaceDetector API
// (instant where available) plus SSD MobileNet V1, run once on the full
// image and again on four overlapping 2x-zoomed quadrants so small/distant
// faces become large enough to detect — then merged with non-max
// suppression. The full-image pass uses a lower confidence floor than the
// zoomed-in quadrant passes, since zoomed-in texture (skin, fabric) triggers
// more false positives.
const MIN_DETECT_LONGEST_SIDE = 1000
const MAX_DETECT_LONGEST_SIDE = 2400
const QUADRANT_MIN_SIZE = 500
const QUADRANT_OVERLAP = 0.2
const NMS_IOU_THRESHOLD = 0.3
const FULL_IMAGE_MIN_CONFIDENCE = 0.3
const QUADRANT_MIN_CONFIDENCE = 0.4
const MAX_RESULTS_PER_PASS = 200

export async function detectFacesMultiScale(bitmap: ImageBitmap): Promise<ScoredBox[]> {
  const faceapi = await loadFaceApi()
  const { canvas: detectCanvas, scaleToNatural } = buildDetectCanvas(bitmap)

  const nativeBoxes = await detectWithNativeApi(detectCanvas, scaleToNatural)
  const fullBoxes = await detectWithSsdMobilenet(
    faceapi,
    detectCanvas,
    0,
    0,
    scaleToNatural,
    FULL_IMAGE_MIN_CONFIDENCE,
  )
  const quadBoxes =
    detectCanvas.width >= QUADRANT_MIN_SIZE && detectCanvas.height >= QUADRANT_MIN_SIZE
      ? await detectQuadrants(faceapi, detectCanvas, scaleToNatural)
      : []

  return nonMaxSuppression([...nativeBoxes, ...fullBoxes, ...quadBoxes], NMS_IOU_THRESHOLD)
}

interface Scale {
  x: number
  y: number
}

function buildDetectCanvas(bitmap: ImageBitmap): { canvas: HTMLCanvasElement; scaleToNatural: Scale } {
  const longest = Math.max(bitmap.width, bitmap.height)
  let scale = 1
  if (longest < MIN_DETECT_LONGEST_SIDE) scale = MIN_DETECT_LONGEST_SIDE / longest
  if (longest > MAX_DETECT_LONGEST_SIDE) scale = MAX_DETECT_LONGEST_SIDE / longest

  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  getContext(canvas).drawImage(bitmap, 0, 0, width, height)

  return { canvas, scaleToNatural: { x: bitmap.width / width, y: bitmap.height / height } }
}

async function detectWithNativeApi(canvas: HTMLCanvasElement, scaleToNatural: Scale): Promise<ScoredBox[]> {
  if (typeof window === 'undefined' || typeof window.FaceDetector !== 'function') return []
  try {
    const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 100 })
    const faces = await detector.detect(canvas)
    return faces.map((face) => ({
      // The native API reports no confidence score; treat it as maximally
      // trustworthy so it wins NMS ties against a duplicate SSD detection.
      score: 1,
      box: {
        x: face.boundingBox.x * scaleToNatural.x,
        y: face.boundingBox.y * scaleToNatural.y,
        width: face.boundingBox.width * scaleToNatural.x,
        height: face.boundingBox.height * scaleToNatural.y,
      },
    }))
  } catch {
    return []
  }
}

async function detectWithSsdMobilenet(
  faceapi: Awaited<ReturnType<typeof loadFaceApi>>,
  canvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
  scaleToNatural: Scale,
  minConfidence: number,
): Promise<ScoredBox[]> {
  const detections = await faceapi.detectAllFaces(
    canvas,
    new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: MAX_RESULTS_PER_PASS }),
  )
  return detections.map((detection) => ({
    score: detection.score,
    box: {
      x: (detection.box.x + offsetX) * scaleToNatural.x,
      y: (detection.box.y + offsetY) * scaleToNatural.y,
      width: detection.box.width * scaleToNatural.x,
      height: detection.box.height * scaleToNatural.y,
    },
  }))
}

async function detectQuadrants(
  faceapi: Awaited<ReturnType<typeof loadFaceApi>>,
  fullCanvas: HTMLCanvasElement,
  scaleToNatural: Scale,
): Promise<ScoredBox[]> {
  const dw = fullCanvas.width
  const dh = fullCanvas.height
  const halfWidth = Math.floor(dw / 2)
  const halfHeight = Math.floor(dh / 2)
  // Overlap so a face straddling a quadrant border isn't cut in half.
  const overlapX = Math.floor(halfWidth * QUADRANT_OVERLAP)
  const overlapY = Math.floor(halfHeight * QUADRANT_OVERLAP)

  const quadrants = [
    { x: 0, y: 0 },
    { x: halfWidth - overlapX, y: 0 },
    { x: 0, y: halfHeight - overlapY },
    { x: halfWidth - overlapX, y: halfHeight - overlapY },
  ]

  const results = await Promise.all(
    quadrants.map(({ x, y }) => {
      const width = Math.min(halfWidth + overlapX, dw - x)
      const height = Math.min(halfHeight + overlapY, dh - y)
      const quadCanvas = document.createElement('canvas')
      quadCanvas.width = width
      quadCanvas.height = height
      getContext(quadCanvas).drawImage(fullCanvas, x, y, width, height, 0, 0, width, height)
      return detectWithSsdMobilenet(faceapi, quadCanvas, x, y, scaleToNatural, QUADRANT_MIN_CONFIDENCE)
    }),
  )
  return results.flat()
}

/** Highest-score-first NMS: drop any box that heavily overlaps one already kept. */
export function nonMaxSuppression(boxes: ScoredBox[], iouThreshold: number): ScoredBox[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score)
  const kept: ScoredBox[] = []
  for (const candidate of sorted) {
    if (!kept.some((k) => iou(k.box, candidate.box) > iouThreshold)) {
      kept.push(candidate)
    }
  }
  return kept
}

export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.width, b.x + b.width)
  const y1 = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = a.width * a.height + b.width * b.height - intersection
  return union > 0 ? intersection / union : 0
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.')
  return ctx
}
