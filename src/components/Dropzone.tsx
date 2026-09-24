import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

interface DropzoneProps {
  onFiles: (files: File[]) => void
}

export function Dropzone({ onFiles }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragActive(true)
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      <UploadIcon />
      <p className="text-lg font-medium text-gray-800 dark:text-gray-100">
        Bilder hierher ziehen
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        oder klicken, um Dateien auszuwählen — beliebig viele auf einmal
      </p>
      <input
        ref={inputRef}
        data-testid="dropzone-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        // The input sits inside the div that opens it via inputRef.click(),
        // so without this its own (bubbling) click re-triggers that same
        // handler and calls click() again.
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-10 w-10 text-gray-400"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5V9m0 0-3 3m3-3 3 3M3 15.75V17a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1.25"
      />
    </svg>
  )
}
