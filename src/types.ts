export type AnonymizeMethod = 'pixelate' | 'blur'

/** A rectangular region in image pixel coordinates. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type ImageStatus = 'queued' | 'processing' | 'done' | 'error'

export interface ProcessedImage {
  fileName: string
  blob: Blob
  url: string
  faceCount: number
  /** Detected face regions (unpadded, in source-image pixel coordinates), kept so a
   * later effect switch (pixelate ↔ blur) can redraw without re-running detection. */
  faceBoxes: Box[]
}

export interface QueueItem {
  id: string
  file: File
  previewUrl: string
  status: ImageStatus
  result?: ProcessedImage
  error?: string
}
