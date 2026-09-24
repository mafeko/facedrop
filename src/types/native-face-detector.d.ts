// The browser Shape Detection API (Chrome/Edge on Android, some desktop
// builds behind a flag). Not part of TypeScript's DOM lib yet.
// https://wicg.github.io/shape-detection-api/#face-detection-api

interface NativeFaceDetectorOptions {
  maxDetectedFaces?: number
  fastMode?: boolean
}

interface NativeDetectedFace {
  readonly boundingBox: DOMRectReadOnly
}

declare class FaceDetector {
  constructor(options?: NativeFaceDetectorOptions)
  detect(image: CanvasImageSource): Promise<NativeDetectedFace[]>
}

interface Window {
  FaceDetector?: typeof FaceDetector
}
