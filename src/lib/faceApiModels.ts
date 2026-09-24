// Model loading for @vladmandic/face-api (MIT). Self-hosted under
// public/models/face-api — nothing is fetched from a CDN. Loaded dynamically
// so the ~5MB model + detection library only download once face detection is
// actually needed.
const MODEL_BASE_PATH = `${import.meta.env.BASE_URL}models/face-api`

type FaceApi = typeof import('@vladmandic/face-api')

let modelsPromise: Promise<FaceApi> | null = null

export function loadFaceApi(): Promise<FaceApi> {
  modelsPromise ??= initFaceApi()
  return modelsPromise
}

async function initFaceApi(): Promise<FaceApi> {
  const faceapi = await import('@vladmandic/face-api')
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE_PATH)
  return faceapi
}
