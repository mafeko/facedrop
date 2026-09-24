import { useCallback, useEffect, useRef, useState } from 'react'
import { anonymizeImage, DEFAULT_ANONYMIZE_OPTIONS } from '../lib/anonymize'
import type { AnonymizeMethod, QueueItem } from '../types'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function useAnonymizeQueue(method: AnonymizeMethod) {
  const [items, setItems] = useState<QueueItem[]>([])
  const processingRef = useRef(false)
  const methodRef = useRef(method)
  useEffect(() => {
    methodRef.current = method
  }, [method])

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter((file) => ACCEPTED_TYPES.includes(file.type))
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

  const isProcessing = items.some((item) => item.status === 'queued' || item.status === 'processing')
  const doneCount = items.filter((item) => item.status === 'done').length

  return { items, addFiles, clear, isProcessing, doneCount }
}
