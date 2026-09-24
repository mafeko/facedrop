import { describe, expect, it } from 'vitest'
import { uniqueName } from './zip'

describe('uniqueName', () => {
  it('returns the name unchanged when it is not yet used', () => {
    const used = new Set<string>()
    expect(uniqueName(used, 'foto.jpg')).toBe('foto.jpg')
  })

  it('registers the returned name so a later call sees it as used', () => {
    const used = new Set<string>()
    uniqueName(used, 'foto.jpg')
    expect(used.has('foto.jpg')).toBe(true)
  })

  it('appends a counter suffix before the extension on collision', () => {
    const used = new Set<string>()
    uniqueName(used, 'foto.jpg')
    expect(uniqueName(used, 'foto.jpg')).toBe('foto-2.jpg')
  })

  it('keeps incrementing the counter across repeated collisions', () => {
    const used = new Set<string>()
    uniqueName(used, 'foto.jpg')
    uniqueName(used, 'foto.jpg')
    uniqueName(used, 'foto.jpg')
    expect(uniqueName(used, 'foto.jpg')).toBe('foto-4.jpg')
  })

  it('handles collisions for names without an extension', () => {
    const used = new Set<string>()
    uniqueName(used, 'foto')
    expect(uniqueName(used, 'foto')).toBe('foto-2')
  })
})
