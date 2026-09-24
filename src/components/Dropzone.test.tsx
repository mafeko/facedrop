import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropzone } from './Dropzone'

function makeFile(name: string, type = 'image/jpeg') {
  return new File(['x'], name, { type })
}

describe('Dropzone', () => {
  it('calls onFiles with the files picked via the hidden file input', async () => {
    const onFiles = vi.fn()
    render(<Dropzone onFiles={onFiles} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = makeFile('kind.jpg')
    await user.upload(input, file)

    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0][0]).toEqual([file])
  })

  it('forwards multiple files from a single selection', async () => {
    const onFiles = vi.fn()
    render(<Dropzone onFiles={onFiles} />)
    const user = userEvent.setup()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    const files = [makeFile('a.jpg'), makeFile('b.png')]
    await user.upload(input, files)

    expect(onFiles.mock.calls[0][0]).toHaveLength(2)
  })

  it('clicking the dropzone opens the native file picker', async () => {
    render(<Dropzone onFiles={vi.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')

    await userEvent.setup().click(screen.getByText('Bilder hierher ziehen'))

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('clears the drag-active state after a drop', () => {
    render(<Dropzone onFiles={vi.fn()} />)
    const dropzone = screen.getByRole('button')

    fireEvent.dragOver(dropzone)
    expect(dropzone.className).toContain('border-blue-500')

    const file = makeFile('gruppenfoto.jpg')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    expect(dropzone.className).not.toContain('border-blue-500')
  })

  it('passes the dropped files through unfiltered (filtering happens upstream)', () => {
    const onFiles = vi.fn()
    render(<Dropzone onFiles={onFiles} />)
    const dropzone = screen.getByRole('button')

    const files = [makeFile('foto.jpg'), makeFile('dokument.pdf', 'application/pdf')]
    fireEvent.drop(dropzone, { dataTransfer: { files } })

    expect(onFiles).toHaveBeenCalledWith(files)
  })
})
