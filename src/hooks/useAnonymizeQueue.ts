import { useCallback, useEffect, useRef, useState } from 'react'
import { anonymizeImage, DEFAULT_ANONYMIZE_OPTIONS, reapplyEffect } from '../lib/anonymize'
import { isAcceptedFile } from '../lib/heic'
import type { AnonymizeMethod, Box, ManualFace, QueueItem } from '../types'

/** Upper bound on concurrently queued images — face detection is CPU-heavy, so this keeps the UI responsive. */
export const MAX_IMAGES = 25

/**
 * Builds the full box list (detected + manual) and the exclusion set (by index into that
 * combined list) for a single render call. Manual faces are appended after detected ones,
 * so their combined index is always `detectedBoxes.length + <their position>`. Detected
 * boxes are swapped for their resize override where one exists, and any removed detected
 * face is folded into the exclusion set so it's never anonymized (its marker is simply
 * hidden in the UI, rather than filtered out of this array, to keep indices stable).
 */
function buildCombinedRenderInputs(
  detectedBoxes: Box[],
  excludedFaceIndices: number[],
  removedFaceIndices: number[],
  faceBoxOverrides: Record<number, Box>,
  manualFaceBoxes: ManualFace[],
): { boxes: Box[]; excluded: Set<number> } {
  const effectiveDetectedBoxes = detectedBoxes.map((box, i) => faceBoxOverrides[i] ?? box)
  const boxes = [...effectiveDetectedBoxes, ...manualFaceBoxes.map((face) => face.box)]
  const excluded = new Set(excludedFaceIndices)
  for (const index of removedFaceIndices) excluded.add(index)
  manualFaceBoxes.forEach((face, i) => {
    if (face.excluded) excluded.add(detectedBoxes.length + i)
  })
  return { boxes, excluded }
}

/** Detected faces still counted, i.e. not dismissed as false positives. */
function activeDetectedCount(detectedBoxes: Box[], removedFaceIndices: number[]): number {
  return detectedBoxes.length - removedFaceIndices.length
}

export function useAnonymizeQueue(method: AnonymizeMethod) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [isReapplying, setIsReapplying] = useState(false)
  const [facesUpdatingIds, setFacesUpdatingIds] = useState<string[]>([])
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const facesUpdatingRef = useRef<Set<string>>(new Set())
  const processingRef = useRef(false)
  const methodRef = useRef(method)
  const itemsRef = useRef(items)
  const isFirstMethodRender = useRef(true)
  useEffect(() => {
    methodRef.current = method
  }, [method])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter(isAcceptedFile)
    if (accepted.length === 0) return

    const remaining = MAX_IMAGES - itemsRef.current.length
    if (remaining <= 0) {
      setLimitNotice(`Limit von ${MAX_IMAGES} Bildern bereits erreicht — weitere Bilder wurden nicht hinzugefügt.`)
      return
    }

    const toAdd = accepted.slice(0, remaining)
    setLimitNotice(
      toAdd.length < accepted.length
        ? `Es können maximal ${MAX_IMAGES} Bilder gleichzeitig verarbeitet werden. Nur die ersten ${toAdd.length} von ${accepted.length} neuen Bildern wurden hinzugefügt.`
        : null,
    )

    const newItems: QueueItem[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
      excludedFaceIndices: [],
      removedFaceIndices: [],
      faceBoxOverrides: {},
      manualFaceBoxes: [],
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const dismissLimitNotice = useCallback(() => setLimitNotice(null), [])

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.result) URL.revokeObjectURL(item.result.url)
      }
      return []
    })
    setLimitNotice(null)
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  useEffect(() => {
    if (processingRef.current) return
    const next = items.find((item) => item.status === 'queued')
    if (!next) return

    processingRef.current = true

    void (async () => {
      updateItem(next.id, { status: 'processing' })
      try {
        const result = await anonymizeImage(
          next.file,
          { ...DEFAULT_ANONYMIZE_OPTIONS, method: methodRef.current },
          new Set(next.excludedFaceIndices),
        )
        updateItem(next.id, { status: 'done', result })
      } catch (error) {
        updateItem(next.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unbekannter Fehler.',
        })
      } finally {
        processingRef.current = false
      }
    })()
  }, [items, updateItem])

  // Switching the effect (pixelate ↔ blur) redraws every already-finished image using its
  // cached face boxes, instead of re-running face detection on the whole batch.
  useEffect(() => {
    if (isFirstMethodRender.current) {
      isFirstMethodRender.current = false
      return
    }
    const doneItems = itemsRef.current.filter((item) => item.status === 'done' && item.result)
    if (doneItems.length === 0) return

    setIsReapplying(true)
    void (async () => {
      try {
        await Promise.all(
          doneItems.map(async (item) => {
            try {
              const detectedBoxes = item.result!.faceBoxes
              const { boxes, excluded } = buildCombinedRenderInputs(
                detectedBoxes,
                item.excludedFaceIndices,
                item.removedFaceIndices,
                item.faceBoxOverrides,
                item.manualFaceBoxes,
              )
              const result = await reapplyEffect(
                item.file,
                boxes,
                { ...DEFAULT_ANONYMIZE_OPTIONS, method },
                excluded,
              )
              URL.revokeObjectURL(item.result!.url)
              // Keep faceBoxes/faceCount reflecting only the detected faces — the combined
              // list above is transient, just for this render call.
              updateItem(item.id, {
                result: {
                  ...result,
                  faceBoxes: detectedBoxes,
                  faceCount: activeDetectedCount(detectedBoxes, item.removedFaceIndices),
                },
              })
            } catch {
              // Keep the previous result rather than losing an already-successful
              // anonymization over a transient canvas error on redraw.
            }
          }),
        )
      } finally {
        setIsReapplying(false)
      }
    })()
  }, [method, updateItem])

  const toggleFace = useCallback(
    (itemId: string, faceIndex: number) => {
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (!item || item.status !== 'done' || !item.result) return
      if (facesUpdatingRef.current.has(itemId)) return
      if (item.removedFaceIndices.includes(faceIndex)) return

      const excludedSet = new Set(item.excludedFaceIndices)
      if (excludedSet.has(faceIndex)) excludedSet.delete(faceIndex)
      else excludedSet.add(faceIndex)
      const excludedFaceIndices = Array.from(excludedSet)

      const detectedBoxes = item.result.faceBoxes
      const { boxes, excluded } = buildCombinedRenderInputs(
        detectedBoxes,
        excludedFaceIndices,
        item.removedFaceIndices,
        item.faceBoxOverrides,
        item.manualFaceBoxes,
      )

      facesUpdatingRef.current.add(itemId)
      setFacesUpdatingIds(Array.from(facesUpdatingRef.current))

      void (async () => {
        try {
          const result = await reapplyEffect(
            item.file,
            boxes,
            { ...DEFAULT_ANONYMIZE_OPTIONS, method: methodRef.current },
            excluded,
          )
          URL.revokeObjectURL(item.result!.url)
          updateItem(itemId, {
            result: {
              ...result,
              faceBoxes: detectedBoxes,
              faceCount: activeDetectedCount(detectedBoxes, item.removedFaceIndices),
            },
            excludedFaceIndices,
          })
        } catch {
          // Keep the previous result rather than losing it over a transient canvas error.
        } finally {
          facesUpdatingRef.current.delete(itemId)
          setFacesUpdatingIds(Array.from(facesUpdatingRef.current))
        }
      })()
    },
    [updateItem],
  )

  /**
   * Shared implementation for adding/removing/toggling/resizing a manually placed face:
   * computes the new manualFaceBoxes array, re-renders with detected + manual faces
   * combined, and commits both the new render and the new manualFaceBoxes together.
   */
  const applyManualFacesChange = useCallback(
    (itemId: string, updater: (manualFaceBoxes: ManualFace[]) => ManualFace[]) => {
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (!item || item.status !== 'done' || !item.result) return
      if (facesUpdatingRef.current.has(itemId)) return

      const manualFaceBoxes = updater(item.manualFaceBoxes)
      const detectedBoxes = item.result.faceBoxes
      const { boxes, excluded } = buildCombinedRenderInputs(
        detectedBoxes,
        item.excludedFaceIndices,
        item.removedFaceIndices,
        item.faceBoxOverrides,
        manualFaceBoxes,
      )

      facesUpdatingRef.current.add(itemId)
      setFacesUpdatingIds(Array.from(facesUpdatingRef.current))

      void (async () => {
        try {
          const result = await reapplyEffect(
            item.file,
            boxes,
            { ...DEFAULT_ANONYMIZE_OPTIONS, method: methodRef.current },
            excluded,
          )
          URL.revokeObjectURL(item.result!.url)
          updateItem(itemId, {
            result: {
              ...result,
              faceBoxes: detectedBoxes,
              faceCount: activeDetectedCount(detectedBoxes, item.removedFaceIndices),
            },
            manualFaceBoxes,
          })
        } catch {
          // Keep the previous result rather than losing it over a transient canvas error.
        } finally {
          facesUpdatingRef.current.delete(itemId)
          setFacesUpdatingIds(Array.from(facesUpdatingRef.current))
        }
      })()
    },
    [updateItem],
  )

  const addManualFace = useCallback(
    (itemId: string, box: Box) => {
      applyManualFacesChange(itemId, (faces) => [...faces, { id: crypto.randomUUID(), box, excluded: false }])
    },
    [applyManualFacesChange],
  )

  const removeManualFace = useCallback(
    (itemId: string, faceId: string) => {
      applyManualFacesChange(itemId, (faces) => faces.filter((face) => face.id !== faceId))
    },
    [applyManualFacesChange],
  )

  const toggleManualFace = useCallback(
    (itemId: string, faceId: string) => {
      applyManualFacesChange(itemId, (faces) =>
        faces.map((face) => (face.id === faceId ? { ...face, excluded: !face.excluded } : face)),
      )
    },
    [applyManualFacesChange],
  )

  const resizeManualFace = useCallback(
    (itemId: string, faceId: string, box: Box) => {
      applyManualFacesChange(itemId, (faces) => faces.map((face) => (face.id === faceId ? { ...face, box } : face)))
    },
    [applyManualFacesChange],
  )

  /**
   * Shared implementation for removing/resizing a detected face — mirrors
   * `applyManualFacesChange` but works on the `removedFaceIndices`/`faceBoxOverrides` pair
   * instead of the manual faces array.
   */
  const applyDetectedFacesChange = useCallback(
    (
      itemId: string,
      updater: (item: QueueItem) => { removedFaceIndices: number[]; faceBoxOverrides: Record<number, Box> },
    ) => {
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (!item || item.status !== 'done' || !item.result) return
      if (facesUpdatingRef.current.has(itemId)) return

      const { removedFaceIndices, faceBoxOverrides } = updater(item)
      const detectedBoxes = item.result.faceBoxes
      const { boxes, excluded } = buildCombinedRenderInputs(
        detectedBoxes,
        item.excludedFaceIndices,
        removedFaceIndices,
        faceBoxOverrides,
        item.manualFaceBoxes,
      )

      facesUpdatingRef.current.add(itemId)
      setFacesUpdatingIds(Array.from(facesUpdatingRef.current))

      void (async () => {
        try {
          const result = await reapplyEffect(
            item.file,
            boxes,
            { ...DEFAULT_ANONYMIZE_OPTIONS, method: methodRef.current },
            excluded,
          )
          URL.revokeObjectURL(item.result!.url)
          updateItem(itemId, {
            result: {
              ...result,
              faceBoxes: detectedBoxes,
              faceCount: activeDetectedCount(detectedBoxes, removedFaceIndices),
            },
            removedFaceIndices,
            faceBoxOverrides,
          })
        } catch {
          // Keep the previous result rather than losing it over a transient canvas error.
        } finally {
          facesUpdatingRef.current.delete(itemId)
          setFacesUpdatingIds(Array.from(facesUpdatingRef.current))
        }
      })()
    },
    [updateItem],
  )

  const removeFace = useCallback(
    (itemId: string, faceIndex: number) => {
      applyDetectedFacesChange(itemId, (item) => ({
        removedFaceIndices: item.removedFaceIndices.includes(faceIndex)
          ? item.removedFaceIndices
          : [...item.removedFaceIndices, faceIndex],
        faceBoxOverrides: item.faceBoxOverrides,
      }))
    },
    [applyDetectedFacesChange],
  )

  const resizeFace = useCallback(
    (itemId: string, faceIndex: number, box: Box) => {
      applyDetectedFacesChange(itemId, (item) => ({
        removedFaceIndices: item.removedFaceIndices,
        faceBoxOverrides: { ...item.faceBoxOverrides, [faceIndex]: box },
      }))
    },
    [applyDetectedFacesChange],
  )

  const isProcessing = items.some((item) => item.status === 'queued' || item.status === 'processing')
  const doneCount = items.filter((item) => item.status === 'done').length

  return {
    items,
    addFiles,
    clear,
    isProcessing,
    isReapplying,
    doneCount,
    toggleFace,
    facesUpdatingIds,
    limitNotice,
    dismissLimitNotice,
    addManualFace,
    removeManualFace,
    toggleManualFace,
    resizeManualFace,
    removeFace,
    resizeFace,
  }
}
