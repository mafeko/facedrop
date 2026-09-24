import type { AnonymizeMethod } from '../types'

const OPTIONS = [
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

export function MethodToggle({
  method,
  onChange,
  disabled,
  compact = false,
}: {
  method: AnonymizeMethod
  onChange: (method: AnonymizeMethod) => void
  disabled: boolean
  /** Single-row, button-height variant for toolbars — same colors/icons, just laid out to match
   * the height of neighboring controls instead of the full descriptive card. */
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-lg border border-border">
        {OPTIONS.map((option) => {
          const selected = method === option.value
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`method-${option.value}`}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`flex h-full items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-muted hover:bg-surface-muted'
                }`}
            >
              <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{option.icon}</span>
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      {OPTIONS.map((option) => {
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
