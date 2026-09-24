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

/** A face region the user placed by hand — a fallback for faces the detector missed. */
export interface ManualFace {
  id: string
  box: Box
  /** Excluded from anonymization (kept visible), same meaning as `excludedFaceIndices` for detected faces. */
  excluded: boolean
}

export interface QueueItem {
  id: string
  file: File
  previewUrl: string
  status: ImageStatus
  result?: ProcessedImage
  error?: string
  /** Indices into `result.faceBoxes` that are excluded from anonymization (kept visible). */
  excludedFaceIndices: number[]
  /** User-added faces the detector didn't find, e.g. in a crowded group photo. */
  manualFaceBoxes: ManualFace[]
}
