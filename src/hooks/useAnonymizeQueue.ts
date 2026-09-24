import { useCallback, useEffect, useRef, useState } from 'react'
import { anonymizeImage, DEFAULT_ANONYMIZE_OPTIONS, reapplyEffect } from '../lib/anonymize'
import { isAcceptedFile } from '../lib/heic'
import type { AnonymizeMethod, Box, ManualFace, QueueItem } from '../types'

/** Upper bound on concurrently queued images — face detection is CPU-heavy, so this keeps the UI responsive. */
export const MAX_IMAGES = 25

/**
 * Builds the full box list (detected + manual) and the exclusion set (by index into that
 * combined list) for a single render call. Manual faces are appended after detected ones,
 * so their combined index is always `detectedBoxes.length + <their position>`.
 */
function buildCombinedRenderInputs(
  detectedBoxes: Box[],
  excludedFaceIndices: number[],
  manualFaceBoxes: ManualFace[],
): { boxes: Box[]; excluded: Set<number> } {
  const boxes = [...detectedBoxes, ...manualFaceBoxes.map((face) => face.box)]
  const excluded = new Set(excludedFaceIndices)
  manualFaceBoxes.forEach((face, i) => {
    if (face.excluded) excluded.add(detectedBoxes.length + i)
  })
  return { boxes, excluded }
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
                result: { ...result, faceBoxes: detectedBoxes, faceCount: detectedBoxes.length },
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

      const excludedSet = new Set(item.excludedFaceIndices)
      if (excludedSet.has(faceIndex)) excludedSet.delete(faceIndex)
      else excludedSet.add(faceIndex)
      const excludedFaceIndices = Array.from(excludedSet)

      const detectedBoxes = item.result.faceBoxes
      const { boxes, excluded } = buildCombinedRenderInputs(
        detectedBoxes,
        excludedFaceIndices,
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
            result: { ...result, faceBoxes: detectedBoxes, faceCount: detectedBoxes.length },
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
            result: { ...result, faceBoxes: detectedBoxes, faceCount: detectedBoxes.length },
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
  }
}
