import { useEffect, useRef, useState } from 'react'
import { MethodToggle } from './MethodToggle'
import { ACCEPT_ATTR } from '../lib/heic'
import type { AnonymizeMethod, Box, QueueItem } from '../types'

interface ManualEditorProps {
  items: QueueItem[]
  method: AnonymizeMethod
  onMethodChange: (method: AnonymizeMethod) => void
  onToggleFace: (itemId: string, faceIndex: number) => void
  facesUpdatingIds: string[]
  onAddFiles: (files: File[]) => void
  onClear: () => void
  onDownloadAll: () => void
  canDownload: boolean
  isProcessing: boolean
  isReapplying: boolean
  doneCount: number
  total: number
  /** Item to open on first render, e.g. when arriving here via "Manuell bearbeiten" from the image preview. */
  initialSelectedId?: string | null
}

export function ManualEditor({
  items,
  method,
  onMethodChange,
  onToggleFace,
  facesUpdatingIds,
  onAddFiles,
  onClear,
  onDownloadAll,
  canDownload,
  isProcessing,
  isReapplying,
  doneCount,
  total,
  initialSelectedId,
}: ManualEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)

  // Fall back to the first item whenever the stored selection is empty or no
  // longer exists (reset, or nothing picked yet), without persisting that
  // fallback back into state.
  const effectiveSelectedId = items.some((item) => item.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? null)
  const selectedItem = items.find((item) => item.id === effectiveSelectedId) ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        method={method}
        onMethodChange={onMethodChange}
        onAddFiles={onAddFiles}
        onClear={onClear}
        onDownloadAll={onDownloadAll}
        canDownload={canDownload}
        isProcessing={isProcessing}
        isReapplying={isReapplying}
        doneCount={doneCount}
        total={total}
      />

      <EditArea
        item={selectedItem}
        onToggleFace={onToggleFace}
        isUpdating={selectedItem ? facesUpdatingIds.includes(selectedItem.id) : false}
      />

      <Filmstrip items={items} selectedId={effectiveSelectedId} onSelect={setSelectedId} />
    </div>
  )
}

function Toolbar({
  method,
  onMethodChange,
  onAddFiles,
  onClear,
  onDownloadAll,
  canDownload,
  isProcessing,
  isReapplying,
  doneCount,
  total,
}: {
  method: AnonymizeMethod
  onMethodChange: (method: AnonymizeMethod) => void
  onAddFiles: (files: File[]) => void
  onClear: () => void
  onDownloadAll: () => void
  canDownload: boolean
  isProcessing: boolean
  isReapplying: boolean
  doneCount: number
  total: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const disabled = isProcessing || isReapplying

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-surface-alt px-4 py-2.5 sm:px-8 lg:px-12 xl:px-20">
      <div className="flex flex-wrap items-center gap-4">
        <MethodToggle method={method} onChange={onMethodChange} disabled={disabled} compact />
        <p
          data-testid="progress-summary"
          data-done-count={doneCount}
          data-total-count={total}
          className="text-sm text-ink-muted"
        >
          {isProcessing
            ? `Verarbeite Bilder … ${doneCount} von ${total} fertig`
            : isReapplying
              ? 'Effekt wird für alle Bilder aktualisiert …'
              : `${doneCount} von ${total} Bildern anonymisiert`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="manual-edit-add-files"
          onClick={() => inputRef.current?.click()}
          className="flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
        >
          Bilder hinzufügen
        </button>
        <input
          ref={inputRef}
          data-testid="manual-edit-add-files-input"
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <button
          type="button"
          data-testid="reset"
          onClick={onClear}
          className="flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
        >
          Zurücksetzen
        </button>
        <button
          type="button"
          data-testid="download-all"
          onClick={onDownloadAll}
          disabled={!canDownload}
          className="flex h-9 items-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Alle herunterladen (ZIP)
        </button>
      </div>
    </div>
  )
}

function EditArea({
  item,
  onToggleFace,
  isUpdating,
}: {
  item: QueueItem | null
  onToggleFace: (itemId: string, faceIndex: number) => void
  isUpdating: boolean
}) {
  if (!item) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-ink-muted">
        Keine Bilder vorhanden.
      </div>
    )
  }

  if (item.status === 'processing' || item.status === 'queued') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-ink-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-muted border-t-transparent" />
        Bild wird verarbeitet …
      </div>
    )
  }

  if (item.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-danger">
        Fehler bei {item.file.name}: {item.error}
      </div>
    )
  }

  return (
    <div
      data-testid="edit-area"
      className="min-h-0 flex-1 overflow-hidden p-4"
    >
      {/* Keyed by item id so local measurement state resets cleanly when the selection changes. */}
      <FaceCanvas key={item.id} item={item} onToggleFace={onToggleFace} isUpdating={isUpdating} />
    </div>
  )
}

interface ContainRect {
  scale: number
  offsetX: number
  offsetY: number
}

/** The rect (scale + centering offset) at which `object-fit: contain` renders `natural` inside `container`. */
function computeContainRect(
  container: { width: number; height: number },
  natural: { width: number; height: number },
): ContainRect | null {
  if (container.width === 0 || container.height === 0 || natural.width === 0 || natural.height === 0) {
    return null
  }
  const scale = Math.min(container.width / natural.width, container.height / natural.height)
  const offsetX = (container.width - natural.width * scale) / 2
  const offsetY = (container.height - natural.height * scale) / 2
  return { scale, offsetX, offsetY }
}

function FaceCanvas({
  item,
  onToggleFace,
  isUpdating,
}: {
  item: QueueItem
  onToggleFace: (itemId: string, faceIndex: number) => void
  isUpdating: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const src = item.result?.url ?? item.previewUrl
  const faceBoxes = item.result?.faceBoxes ?? []

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rect = containerSize && naturalSize ? computeContainRect(containerSize, naturalSize) : null

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* object-contain guarantees the whole photo stays visible (letterboxed, never cropped)
          regardless of its aspect ratio vs. the available editor space. */}
      <img
        src={src}
        alt={item.file.name}
        className="absolute inset-0 h-full w-full select-none rounded-lg object-contain shadow-card"
        onLoad={(event) => {
          const img = event.currentTarget
          setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
        }}
      />

      {rect &&
        faceBoxes.map((box, index) => (
          <FaceMarker
            key={index}
            box={box}
            index={index}
            rect={rect}
            excluded={item.excludedFaceIndices.includes(index)}
            disabled={isUpdating}
            onToggle={() => onToggleFace(item.id, index)}
          />
        ))}

      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}
    </div>
  )
}

function FaceMarker({
  box,
  index,
  rect,
  excluded,
  disabled,
  onToggle,
}: {
  box: Box
  index: number
  rect: ContainRect
  excluded: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const size = Math.max(box.width, box.height) * 1.5 * rect.scale
  const centerX = rect.offsetX + (box.x + box.width / 2) * rect.scale
  const centerY = rect.offsetY + (box.y + box.height / 2) * rect.scale

  return (
    <button
      type="button"
      data-testid="face-marker"
      data-face-index={index}
      data-excluded={excluded}
      disabled={disabled}
      onClick={onToggle}
      aria-label={
        excluded
          ? `Gesicht ${index + 1}: nicht anonymisiert, anklicken zum Anonymisieren`
          : `Gesicht ${index + 1}: anonymisiert, anklicken zum Ausnehmen`
      }
      className={`absolute rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        excluded
          ? 'border-secondary bg-secondary/10 hover:bg-secondary/20'
          : 'border-primary bg-primary/10 hover:bg-primary/20'
      }`}
      style={{
        left: centerX - size / 2,
        top: centerY - size / 2,
        width: size,
        height: size,
      }}
    >
      <span
        className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white text-white shadow ${
          excluded ? 'bg-secondary' : 'bg-primary'
        }`}
      >
        {excluded ? <FaceVisibleIcon /> : <FaceHiddenIcon />}
      </span>
    </button>
  )
}

function Filmstrip({
  items,
  selectedId,
  onSelect,
}: {
  items: QueueItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div
      data-testid="filmstrip"
      className="flex h-28 shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-surface-alt px-4 py-2 sm:px-8 lg:px-12 xl:px-20"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid="filmstrip-item"
          data-item-id={item.id}
          onClick={() => onSelect(item.id)}
          aria-label={`${item.file.name} auswählen`}
          className={`relative aspect-square h-full shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
            item.id === selectedId
              ? 'border-primary ring-2 ring-primary'
              : 'border-transparent hover:border-border-strong'
          }`}
        >
          <img
            src={item.result?.url ?? item.previewUrl}
            alt=""
            className={`h-full w-full object-cover ${item.status === 'processing' ? 'opacity-50' : 'opacity-100'}`}
          />
          {item.status === 'processing' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
          {item.status === 'error' && (
            <span className="absolute inset-0 flex items-center justify-center bg-danger/80 text-[10px] text-white">
              Fehler
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function FaceHiddenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-3 w-3"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" d="M6 6l12 12" />
    </svg>
  )
}

function FaceVisibleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-3 w-3"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" d="M9 15c1 1 5 1 6 0" />
    </svg>
  )
}
