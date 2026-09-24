import { useState } from 'react'
import { Dropzone } from './components/Dropzone'
import { ImageGrid } from './components/ImageGrid'
import { useAnonymizeQueue } from './hooks/useAnonymizeQueue'
import { downloadAllAsZip } from './lib/zip'
import type { AnonymizeMethod } from './types'

function App() {
  const [method, setMethod] = useState<AnonymizeMethod>('pixelate')
  const { items, addFiles, clear, isProcessing, doneCount } = useAnonymizeQueue(method)

  const total = items.length
  const canDownload = doneCount > 0 && !isProcessing

  async function handleDownloadAll() {
    const results = items.filter((item) => item.result).map((item) => item.result!)
    await downloadAllAsZip(results)
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">facedrop</h1>
        <p className="mx-auto mt-2 max-w-xl text-gray-600 dark:text-gray-400">
          Gesichter auf Fotos automatisch unkenntlich machen — bevor sie online gehen. Die
          Verarbeitung läuft komplett lokal in deinem Browser, es wird kein Bild irgendwohin
          hochgeladen.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <MethodToggle method={method} onChange={setMethod} disabled={isProcessing} />
      </div>

      <Dropzone onFiles={addFiles} />

      {total > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p
            data-testid="progress-summary"
            data-done-count={doneCount}
            data-total-count={total}
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            {isProcessing
              ? `Verarbeite Bilder … ${doneCount} von ${total} fertig`
              : `${doneCount} von ${total} Bildern anonymisiert`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="reset"
              onClick={clear}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Zurücksetzen
            </button>
            <button
              type="button"
              data-testid="download-all"
              onClick={handleDownloadAll}
              disabled={!canDownload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Alle herunterladen (ZIP)
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <ImageGrid items={items} />
      </div>
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
  return (
    <div className="inline-flex rounded-lg border border-gray-300 p-1 dark:border-gray-700">
      {(
        [
          ['pixelate', 'Verpixeln'],
          ['blur', 'Weichzeichnen'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          data-testid={`method-${value}`}
          disabled={disabled}
          onClick={() => onChange(value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            method === value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default App
