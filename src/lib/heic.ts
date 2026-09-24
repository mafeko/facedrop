const HEIC_MIME_TYPES = ['image/heic', 'image/heif']
const HEIC_EXTENSION = /\.hei[cf]$/i

const STANDARD_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** File pickers filter by extension on some OSes, so both are listed. */
export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,.heic,.heif,image/heic,image/heif'

export function isHeicFile(file: File): boolean {
  return HEIC_MIME_TYPES.includes(file.type) || HEIC_EXTENSION.test(file.name)
}

export function isAcceptedFile(file: File): boolean {
  return STANDARD_TYPES.includes(file.type) || isHeicFile(file)
}

/**
 * Converts a HEIC/HEIF file to a JPEG blob using a WASM build of libheif,
 * loaded on demand so the ~2.7 MB decoder never lands in the main bundle
 * for users who never drop a HEIC file.
 */
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  let result: Blob | Blob[]
  try {
    result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  } catch {
    throw new Error('HEIC-Foto konnte nicht dekodiert werden.')
  }
  return Array.isArray(result) ? result[0] : result
}
