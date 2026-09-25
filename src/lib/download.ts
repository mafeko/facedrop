import type { ProcessedImage } from '../types'

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downloads a single anonymized image as a plain file — no ZIP, so it opens directly in a
 * mobile browser's own downloads/photos flow instead of a format many non-technical users
 * won't know how to unpack. */
export function downloadImage(image: ProcessedImage) {
  triggerDownload(image.blob, image.fileName)
}
