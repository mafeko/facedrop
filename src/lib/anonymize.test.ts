import { describe, expect, it } from 'vitest'
import { buildOutputFileName, padBox } from './anonymize'
import type { Box } from '../types'

function box(overrides: Partial<Box> = {}): Box {
  return { x: 100, y: 100, width: 50, height: 50, ...overrides }
}

describe('padBox', () => {
  it('expands the box by the padding fraction on all sides', () => {
    const result = padBox(box(), 0.2, 1000, 1000)
    // padX = 10, padTop = 16, padBottom = 10
    expect(result.x).toBe(90)
    expect(result.y).toBe(84)
    expect(result.width).toBe(70)
    expect(result.height).toBe(76)
  })

  it('gives extra headroom above the box compared to below it', () => {
    const result = padBox(box(), 0.2, 1000, 1000)
    const paddingAbove = 100 - result.y
    const paddingBelow = result.y + result.height - (100 + 50)
    expect(paddingAbove).toBeGreaterThan(paddingBelow)
  })

  it('clamps to the left/top image edge', () => {
    const result = padBox(box({ x: 5, y: 5 }), 0.5, 1000, 1000)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('clamps to the right/bottom image edge', () => {
    const result = padBox(box({ x: 950, y: 950 }), 0.5, 1000, 1000)
    expect(result.x + result.width).toBe(1000)
    expect(result.y + result.height).toBe(1000)
  })

  it('never produces a zero-sized box even at the extreme corner', () => {
    const result = padBox(box({ x: 1000, y: 1000, width: 0, height: 0 }), 0.3, 1000, 1000)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('caps the padding in absolute pixels for a large face instead of scaling with it', () => {
    // A close-up face taking up most of a 1000x1000 image: the raw fraction (0.2 * 800 = 160)
    // would dwarf the photo's own scale, so it should be capped well below that.
    const big = box({ x: 100, y: 100, width: 800, height: 800 })
    const result = padBox(big, 0.2, 1000, 1000)
    const sidePadding = big.x - result.x
    expect(sidePadding).toBeLessThan(800 * 0.2)
    expect(sidePadding).toBeCloseTo(35, 5) // 1000 * 0.035
  })

  it('leaves a typically-sized face unaffected by the cap', () => {
    const result = padBox(box(), 0.2, 1000, 1000)
    expect(result.x).toBe(90) // uncapped: 50 * 0.2 = 10
  })
})

describe('buildOutputFileName', () => {
  it('appends "-anonymisiert" before a jpg extension', () => {
    expect(buildOutputFileName('kita-ausflug.jpg')).toBe('kita-ausflug-anonymisiert.jpg')
  })

  it('normalizes uppercase/unknown extensions to jpg', () => {
    expect(buildOutputFileName('foto.JPEG')).toBe('foto-anonymisiert.jpg')
    expect(buildOutputFileName('foto.webp')).toBe('foto-anonymisiert.jpg')
  })

  it('keeps png as png', () => {
    expect(buildOutputFileName('logo.png')).toBe('logo-anonymisiert.png')
  })

  it('handles file names without an extension', () => {
    expect(buildOutputFileName('IMG_1234')).toBe('IMG_1234-anonymisiert.jpg')
  })

  it('handles dotfiles without treating the leading dot as an extension separator', () => {
    expect(buildOutputFileName('.hidden')).toBe('.hidden-anonymisiert.jpg')
  })
})
