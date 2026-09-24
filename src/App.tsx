import { useState } from 'react'
import { Dropzone } from './components/Dropzone'
import { ImageGrid } from './components/ImageGrid'
import { useAnonymizeQueue } from './hooks/useAnonymizeQueue'
import { downloadAllAsZip } from './lib/zip'
import type { AnonymizeMethod } from './types'

function App() {
  const [method, setMethod] = useState<AnonymizeMethod>('pixelate')
  const { items, addFiles, clear, isProcessing, isReapplying, doneCount } = useAnonymizeQueue(method)

  const total = items.length
  const canDownload = doneCount > 0 && !isProcessing && !isReapplying

  async function handleDownloadAll() {
    const results = items.filter((item) => item.result).map((item) => item.result!)
    await downloadAllAsZip(results)
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-alt/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <img src="/logo.png" alt="facedrop" className="h-8 w-auto" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-soft px-3 py-1 text-xs font-semibold text-secondary-ink">
            <LockIcon />
            100% Sicher &amp; Lokal auf Ihrem Computer
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-2 pb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Fotos reinziehen. Gesichter anonymisiert herunterladen.
          </h1>
          <p className="max-w-xl text-ink-muted">
            Gesichter auf Fotos automatisch unkenntlich machen — bevor sie online gehen. Deine
            Bilder verlassen deinen Computer nicht (werden nicht hochgeladen).

          </p>

        </section>

        <div className="mb-6 flex justify-center">
          <MethodToggle method={method} onChange={setMethod} disabled={isProcessing || isReapplying} />
        </div>

        <Dropzone onFiles={addFiles} />

        {total > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="reset"
                onClick={clear}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
              >
                Zurücksetzen
              </button>
              <button
                type="button"
                data-testid="download-all"
                onClick={handleDownloadAll}
                disabled={!canDownload}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Alle herunterladen (ZIP)
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <ImageGrid items={items} />
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-surface-alt">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
          <div className="flex items-center gap-3 text-left">
            <ShieldIcon />
            <p className="text-sm text-ink-muted">
              Ihre Fotos werden <span className="font-semibold text-ink">niemals</span> ins
              Internet hochgeladen. Alle Gesichter werden direkt im Browser auf Ihrem Rechner
              verarbeitet.
            </p>
          </div>
          <a
            href="https://github.com/mafeko/facedrop"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <GitHubIcon />
            facedrop
          </a>
        </div>
      </footer>
    </div>
  )
}

function MethodToggle({
  method,
  onChange,
  disabled,
}: {
  method: AnonymizeMethod
  onChange: (method: AnonymizeMethod) => void
  disabled: boolean
}) {
  const options = [
    {
      value: 'pixelate' as const,
      label: 'Verpixeln',
      description: 'Blockartiges Mosaik über dem Gesicht',
      icon: <PixelateIcon />,
    },
    {
      value: 'blur' as const,
      label: 'Weichzeichnen',
      description: 'Sanfter, weicher Unschärfe-Effekt',
      icon: <BlurIcon />,
    },
  ]

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      {options.map((option) => {
        const selected = method === option.value
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`method-${option.value}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${selected
                ? 'border-primary bg-primary-soft ring-2 ring-primary'
                : 'border-border bg-surface-alt hover:border-border-strong'
              }`}
          >
            <span className={selected ? 'text-primary' : 'text-ink-muted'}>{option.icon}</span>
            <span className="text-sm font-semibold text-ink">{option.label}</span>
            <span className="text-xs text-ink-muted">{option.description}</span>
            {selected && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                <CheckIcon />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 0 1 6 0v3Z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6 shrink-0 text-secondary"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.2.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}

function PixelateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" opacity="0.5" />
      <rect x="3" y="14" width="7" height="7" opacity="0.5" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function BlurIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeDasharray="1.5 3" />
    </svg>
  )
}

export default App
