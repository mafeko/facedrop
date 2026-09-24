import { useCallback, useEffect, useRef, useState } from 'react'
import { anonymizeImage, DEFAULT_ANONYMIZE_OPTIONS, reapplyEffect } from '../lib/anonymize'
import { isAcceptedFile } from '../lib/heic'
import type { AnonymizeMethod, QueueItem } from '../types'

export function useAnonymizeQueue(method: AnonymizeMethod) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [isReapplying, setIsReapplying] = useState(false)
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
    const newItems: QueueItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.result) URL.revokeObjectURL(item.result.url)
      }
      return []
    })
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
        const result = await anonymizeImage(next.file, {
          ...DEFAULT_ANONYMIZE_OPTIONS,
          method: methodRef.current,
        })
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
              const result = await reapplyEffect(item.file, item.result!.faceBoxes, {
                ...DEFAULT_ANONYMIZE_OPTIONS,
                method,
              })
              URL.revokeObjectURL(item.result!.url)
              updateItem(item.id, { result })
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

  const isProcessing = items.some((item) => item.status === 'queued' || item.status === 'processing')
  const doneCount = items.filter((item) => item.status === 'done').length

  return { items, addFiles, clear, isProcessing, isReapplying, doneCount }
}
