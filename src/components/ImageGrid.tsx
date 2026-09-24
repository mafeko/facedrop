import { useState } from 'react'
import { ImagePreviewModal } from './ImagePreviewModal'
import type { QueueItem } from '../types'

interface ImageGridProps {
  items: QueueItem[]
  onEditManually: (itemId: string) => void
}

export function ImageGrid({ items, onEditManually }: ImageGridProps) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  // If the previewed item disappears (e.g. the queue was reset), this is
  // simply null and the modal stops rendering — no extra state to reconcile.
  const previewItem = items.find((item) => item.id === previewId) ?? null

  if (items.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <figure
            key={item.id}
            data-testid="queue-item"
            data-status={item.status}
            role="button"
            tabIndex={0}
            aria-label={`Vorschau von ${item.file.name} anzeigen`}
            onClick={() => setPreviewId(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setPreviewId(item.id)
              }
            }}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={item.result?.url ?? item.previewUrl}
              alt=""
              className={`h-full w-full object-cover transition-opacity ${
                item.status === 'processing' ? 'opacity-50' : 'opacity-100'
              }`}
            />
            <StatusOverlay item={item} />
          </figure>
        ))}
      </div>

      {previewItem && (
        <ImagePreviewModal
          item={previewItem}
          onClose={() => setPreviewId(null)}
          onEditManually={() => {
            onEditManually(previewItem.id)
            setPreviewId(null)
          }}
        />
      )}
    </>
  )
}

function StatusOverlay({ item }: { item: QueueItem }) {
  if (item.status === 'processing') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }
  if (item.status === 'error') {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-danger/80 p-2 text-center text-xs text-white"
        title={item.error}
      >
        Fehler
      </div>
    )
  }
  if (item.status === 'done') {
    return (
      <span
        data-testid="face-count"
        data-face-count={item.result?.faceCount ?? 0}
        className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
      >
        {item.result?.faceCount ?? 0} {item.result?.faceCount === 1 ? 'Gesicht' : 'Gesichter'}
      </span>
    )
  }
  return null
}
