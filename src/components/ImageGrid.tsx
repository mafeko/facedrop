import type { QueueItem } from '../types'

interface ImageGridProps {
  items: QueueItem[]
}

export function ImageGrid({ items }: ImageGridProps) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <figure
          key={item.id}
          data-testid="queue-item"
          data-status={item.status}
          className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
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
        className="absolute inset-0 flex items-center justify-center bg-red-900/60 p-2 text-center text-xs text-white"
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
