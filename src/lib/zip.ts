import JSZip from 'jszip'
import { triggerDownload } from './download'
import type { ProcessedImage } from '../types'

export async function downloadAllAsZip(images: ProcessedImage[]) {
  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const image of images) {
    zip.file(uniqueName(usedNames, image.fileName), image.blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, `facedrop-${timestamp()}.zip`)
}

export function uniqueName(used: Set<string>, name: string): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dotIndex = name.lastIndexOf('.')
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
  let candidate = name
  let i = 2
  while (used.has(candidate)) {
    candidate = `${base}-${i}${ext}`
    i += 1
  }
  used.add(candidate)
  return candidate
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
