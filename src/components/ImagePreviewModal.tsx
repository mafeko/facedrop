import { useEffect } from 'react'
import type { QueueItem } from '../types'

interface ImagePreviewModalProps {
  item: QueueItem
  onClose: () => void
  onEditManually: () => void
}

export function ImagePreviewModal({ item, onClose, onEditManually }: ImagePreviewModalProps) {
  // Shown for every processed image, not just ones with a detected face — manual editing
  // also covers adding a face the detector missed entirely (e.g. a crowded group photo).
  const canEditManually = item.status === 'done'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      data-testid="preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Vorschau von ${item.file.name}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 sm:p-8"
    >
      <button
        type="button"
        data-testid="preview-modal-close"
        onClick={onClose}
        aria-label="Vorschau schließen"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <CloseIcon />
      </button>

      <img
        src={item.result?.url ?? item.previewUrl}
        alt=""
        className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
      />

      <p className="max-w-full truncate px-2 text-center text-sm text-gray-200">
        {item.file.name}
        {item.status === 'done' && (
          <span className="text-gray-400">
            {' · '}
            {item.result?.faceCount ?? 0} {item.result?.faceCount === 1 ? 'Gesicht' : 'Gesichter'}
          </span>
        )}
        {item.status === 'processing' && <span className="text-gray-400"> · wird verarbeitet …</span>}
        {item.status === 'error' && <span className="text-red-400"> · Fehler: {item.error}</span>}
      </p>

      {canEditManually && (
        <button
          type="button"
          data-testid="preview-edit-manually"
          onClick={(event) => {
            event.stopPropagation()
            onEditManually()
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-hover"
        >
          <PencilIcon />
          Manuell bearbeiten
        </button>
      )}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 3.5 4 4L7 21l-4.5 1L4 17.5 16.5 3.5Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}
