import { describe, expect, it } from 'vitest'
import { isAcceptedFile, isHeicFile } from './heic'

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('isHeicFile', () => {
  it('accepts the image/heic and image/heif MIME types', () => {
    expect(isHeicFile(makeFile('photo.heic', 'image/heic'))).toBe(true)
    expect(isHeicFile(makeFile('photo.heif', 'image/heif'))).toBe(true)
  })

  it('falls back to the file extension when the browser reports no MIME type', () => {
    expect(isHeicFile(makeFile('IMG_1234.HEIC', ''))).toBe(true)
    expect(isHeicFile(makeFile('IMG_1234.heif', ''))).toBe(true)
  })

  it('rejects non-HEIC files', () => {
    expect(isHeicFile(makeFile('photo.jpg', 'image/jpeg'))).toBe(false)
    expect(isHeicFile(makeFile('photo.png', 'image/png'))).toBe(false)
  })
})

describe('isAcceptedFile', () => {
  it('accepts JPEG, PNG, WebP and HEIC/HEIF', () => {
    expect(isAcceptedFile(makeFile('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isAcceptedFile(makeFile('a.png', 'image/png'))).toBe(true)
    expect(isAcceptedFile(makeFile('a.webp', 'image/webp'))).toBe(true)
    expect(isAcceptedFile(makeFile('a.heic', 'image/heic'))).toBe(true)
    expect(isAcceptedFile(makeFile('a.heic', ''))).toBe(true)
  })

  it('rejects unsupported types', () => {
    expect(isAcceptedFile(makeFile('a.gif', 'image/gif'))).toBe(false)
    expect(isAcceptedFile(makeFile('a.pdf', 'application/pdf'))).toBe(false)
  })
})
