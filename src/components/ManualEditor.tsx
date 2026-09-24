import { useEffect, useRef, useState } from 'react'
import { MethodToggle } from './MethodToggle'
import { ACCEPT_ATTR } from '../lib/heic'
import type { AnonymizeMethod, Box, ManualFace, QueueItem } from '../types'

interface ManualEditorProps {
  items: QueueItem[]
  method: AnonymizeMethod
  onMethodChange: (method: AnonymizeMethod) => void
  onToggleFace: (itemId: string, faceIndex: number) => void
  onAddManualFace: (itemId: string, box: Box) => void
  onRemoveManualFace: (itemId: string, faceId: string) => void
  onToggleManualFace: (itemId: string, faceId: string) => void
  onResizeManualFace: (itemId: string, faceId: string, box: Box) => void
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
  onAddManualFace,
  onRemoveManualFace,
  onToggleManualFace,
  onResizeManualFace,
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
        onAddManualFace={onAddManualFace}
        onRemoveManualFace={onRemoveManualFace}
        onToggleManualFace={onToggleManualFace}
        onResizeManualFace={onResizeManualFace}
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
  onAddManualFace,
  onRemoveManualFace,
  onToggleManualFace,
  onResizeManualFace,
  isUpdating,
}: {
  item: QueueItem | null
  onToggleFace: (itemId: string, faceIndex: number) => void
  onAddManualFace: (itemId: string, box: Box) => void
  onRemoveManualFace: (itemId: string, faceId: string) => void
  onToggleManualFace: (itemId: string, faceId: string) => void
  onResizeManualFace: (itemId: string, faceId: string, box: Box) => void
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
      <FaceCanvas
        key={item.id}
        item={item}
        onToggleFace={onToggleFace}
        onAddManualFace={onAddManualFace}
        onRemoveManualFace={onRemoveManualFace}
        onToggleManualFace={onToggleManualFace}
        onResizeManualFace={onResizeManualFace}
        isUpdating={isUpdating}
      />
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
  onAddManualFace,
  onRemoveManualFace,
  onToggleManualFace,
  onResizeManualFace,
  isUpdating,
}: {
  item: QueueItem
  onToggleFace: (itemId: string, faceIndex: number) => void
  onAddManualFace: (itemId: string, box: Box) => void
  onRemoveManualFace: (itemId: string, faceId: string) => void
  onToggleManualFace: (itemId: string, faceId: string) => void
  onResizeManualFace: (itemId: string, faceId: string, box: Box) => void
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

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isUpdating || !rect || !naturalSize || !containerSize) return
    const target = event.target as HTMLElement

    // Double-clicking an existing marker (detected or manual) shouldn't stack a new one
    // underneath it — removal of a manual face has its own explicit button instead, since
    // a marker's single click already toggles it, which would race a double-click here.
    if (target.closest('[data-testid="face-marker"], [data-testid="manual-face-marker"]')) return

    const containerRect = event.currentTarget.getBoundingClientRect()
    const sourceX = (event.clientX - containerRect.left - rect.offsetX) / rect.scale
    const sourceY = (event.clientY - containerRect.top - rect.offsetY) / rect.scale
    if (sourceX < 0 || sourceY < 0 || sourceX > naturalSize.width || sourceY > naturalSize.height) return

    // Sized in screen space, not source-image space: a small/heavily-upscaled source image
    // (large rect.scale) would otherwise turn a "reasonable" source-pixel radius into a
    // circle bigger than the viewport, pushing its resize handle off-screen (unreachable).
    // Capping the on-screen diameter guarantees the whole marker — including the handle —
    // always fits within the visible editor.
    const viewportMinDimension = Math.min(containerSize.width, containerSize.height)
    const onScreenDiameter = Math.min(140, Math.max(48, viewportMinDimension * 0.2))
    const sourceRadius = Math.max(4, onScreenDiameter / 2 / rect.scale)

    onAddManualFace(item.id, {
      x: sourceX - sourceRadius,
      y: sourceY - sourceRadius,
      width: sourceRadius * 2,
      height: sourceRadius * 2,
    })
  }

  return (
    <div
      ref={containerRef}
      data-testid="face-canvas"
      onDoubleClick={handleDoubleClick}
      className="relative h-full w-full"
    >
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

      {rect &&
        naturalSize &&
        item.manualFaceBoxes.map((face) => (
          <ManualFaceMarker
            key={face.id}
            face={face}
            rect={rect}
            naturalSize={naturalSize}
            containerRef={containerRef}
            disabled={isUpdating}
            onToggle={() => onToggleManualFace(item.id, face.id)}
            onResize={(box) => onResizeManualFace(item.id, face.id, box)}
            onRemove={() => onRemoveManualFace(item.id, face.id)}
          />
        ))}

      {rect && (
        <p className="pointer-events-none absolute bottom-3 left-3 max-w-[85%] rounded-md bg-black/55 px-2.5 py-1.5 text-xs text-white">
          Tipp: Doppelklick fügt ein nicht erkanntes Gesicht manuell hinzu — am Punkt lässt sich die
          Größe anpassen, über das × wieder entfernen.
        </p>
      )}

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

/**
 * A user-placed face marker — same toggle behavior as a detected `FaceMarker`, plus a drag
 * handle to resize it (the AI has no box to go by here, so the user picks one) and a dashed
 * border to visually mark it as manual rather than detected.
 */
function ManualFaceMarker({
  face,
  rect,
  naturalSize,
  containerRef,
  disabled,
  onToggle,
  onResize,
  onRemove,
}: {
  face: ManualFace
  rect: ContainRect
  naturalSize: { width: number; height: number }
  containerRef: { current: HTMLDivElement | null }
  disabled: boolean
  onToggle: () => void
  onResize: (box: Box) => void
  onRemove: () => void
}) {
  const [liveBox, setLiveBox] = useState<Box | null>(null)
  const box = liveBox ?? face.box

  const size = Math.max(box.width, box.height) * rect.scale
  const centerX = rect.offsetX + (box.x + box.width / 2) * rect.scale
  const centerY = rect.offsetY + (box.y + box.height / 2) * rect.scale

  function handleResizePointerDown(event: React.PointerEvent<HTMLSpanElement>) {
    if (disabled) return
    event.stopPropagation()
    event.preventDefault()

    const container = containerRef.current
    if (!container) return
    const centerSourceX = face.box.x + face.box.width / 2
    const centerSourceY = face.box.y + face.box.height / 2
    const minRadius = 12
    const maxRadius = Math.min(naturalSize.width, naturalSize.height) / 2

    function handleMove(moveEvent: PointerEvent) {
      const containerRect = container!.getBoundingClientRect()
      const sourceX = (moveEvent.clientX - containerRect.left - rect.offsetX) / rect.scale
      const sourceY = (moveEvent.clientY - containerRect.top - rect.offsetY) / rect.scale
      const radius = Math.min(
        maxRadius,
        Math.max(minRadius, Math.hypot(sourceX - centerSourceX, sourceY - centerSourceY)),
      )
      setLiveBox({ x: centerSourceX - radius, y: centerSourceY - radius, width: radius * 2, height: radius * 2 })
    }

    function handleUp(upEvent: PointerEvent) {
      handleMove(upEvent)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      // Read the just-set live box back out via the setter to commit it exactly once.
      setLiveBox((current) => {
        if (current) onResize(current)
        return null
      })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      data-testid="manual-face-marker"
      data-manual-face-id={face.id}
      data-excluded={face.excluded}
      className={`absolute ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      style={{ left: centerX - size / 2, top: centerY - size / 2, width: size, height: size }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={
          face.excluded
            ? 'Manuell hinzugefügtes Gesicht: nicht anonymisiert, anklicken zum Anonymisieren'
            : 'Manuell hinzugefügtes Gesicht: anonymisiert, anklicken zum Ausnehmen'
        }
        className={`h-full w-full rounded-full border-2 border-dashed transition-colors disabled:cursor-not-allowed ${
          face.excluded
            ? 'border-secondary bg-secondary/10 hover:bg-secondary/20'
            : 'border-primary bg-primary/10 hover:bg-primary/20'
        }`}
      />
      <span
        className={`pointer-events-none absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white text-white shadow ${
          face.excluded ? 'bg-secondary' : 'bg-primary'
        }`}
      >
        {face.excluded ? <FaceVisibleIcon /> : <FaceHiddenIcon />}
      </span>
      <span
        data-testid="manual-face-resize-handle"
        onPointerDown={handleResizePointerDown}
        aria-hidden="true"
        className="absolute -left-1 -top-1 h-3.5 w-3.5 cursor-nwse-resize rounded-full border border-white bg-ink shadow"
      />
      <button
        type="button"
        data-testid="manual-face-remove"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
        aria-label="Manuell hinzugefügtes Gesicht entfernen"
        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-ink text-white shadow transition-colors hover:bg-ink/80 disabled:cursor-not-allowed"
      >
        <RemoveIcon />
      </button>
    </div>
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

function RemoveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      className="h-2 w-2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
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
