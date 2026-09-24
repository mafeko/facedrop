import { describe, expect, it } from 'vitest'
import { iou, nonMaxSuppression } from './multiScaleDetect'
import type { Box } from '../types'

function box(overrides: Partial<Box> = {}): Box {
  return { x: 0, y: 0, width: 100, height: 100, ...overrides }
}

describe('iou', () => {
  it('is 1 for identical boxes', () => {
    expect(iou(box(), box())).toBe(1)
  })

  it('is 0 for boxes that do not overlap at all', () => {
    expect(iou(box(), box({ x: 200, y: 200 }))).toBe(0)
  })

  it('is between 0 and 1 for partially overlapping boxes', () => {
    const overlap = iou(box(), box({ x: 50, y: 0 }))
    expect(overlap).toBeGreaterThan(0)
    expect(overlap).toBeLessThan(1)
  })
})

describe('nonMaxSuppression', () => {
  it('keeps a single box unchanged', () => {
    const boxes = [{ box: box(), score: 0.9 }]
    expect(nonMaxSuppression(boxes, 0.3)).toHaveLength(1)
  })

  it('drops the lower-scored box when two heavily overlap (duplicate detections of the same face)', () => {
    const boxes = [
      { box: box(), score: 0.6 },
      { box: box({ x: 5, y: 5 }), score: 0.9 },
    ]
    const kept = nonMaxSuppression(boxes, 0.3)
    expect(kept).toHaveLength(1)
    expect(kept[0].score).toBe(0.9)
  })

  it('keeps both boxes when they do not overlap (two distinct faces)', () => {
    const boxes = [
      { box: box(), score: 0.6 },
      { box: box({ x: 500, y: 500 }), score: 0.9 },
    ]
    expect(nonMaxSuppression(boxes, 0.3)).toHaveLength(2)
  })

  it('merges detections of the same face from the full-image pass and a quadrant pass', () => {
    // Same face found twice: once in the full-image pass (lower confidence,
    // since the face is small relative to the whole image) and once in a
    // zoomed quadrant pass (higher confidence). Only the better one survives.
    const fullImageHit = { box: box({ x: 100, y: 100, width: 40, height: 40 }), score: 0.35 }
    const quadrantHit = { box: box({ x: 102, y: 98, width: 42, height: 41 }), score: 0.91 }
    const kept = nonMaxSuppression([fullImageHit, quadrantHit], 0.3)
    expect(kept).toEqual([quadrantHit])
  })
})
