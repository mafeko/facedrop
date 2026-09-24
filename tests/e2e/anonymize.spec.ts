import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures = (name: string) => path.join(__dirname, '..', 'fixtures', 'images', name)

const EINSTEIN = fixtures('einstein.jpg')
const EINSTEIN_HEIC = fixtures('einstein.heic')
const MONA_LISA = fixtures('mona-lisa.jpg')
const GROUP_PHOTO = fixtures('apollo11-crew.jpg')
const NO_FACE = fixtures('no-face-earth.jpg')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('erkennt ein Gesicht in einem Einzelfoto und verpixelt es automatisch', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)

  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done')

  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '1')
  await expect(page.getByTestId('download-all')).toBeEnabled()
})

test('verarbeitet mehrere Bilder als Batch und zählt den Fortschritt', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles([EINSTEIN, MONA_LISA])

  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-done-count', '2')
  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-total-count', '2')
  await expect(page.getByTestId('queue-item')).toHaveCount(2)

  for (const item of await page.getByTestId('queue-item').all()) {
    await expect(item).toHaveAttribute('data-status', 'done')
  }
})

test('erkennt mehrere Gesichter in einem Gruppenfoto', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(GROUP_PHOTO)

  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done')

  // All 3 crew members: the multi-scale (quadrant-zoom) detection catches
  // the third face that a single full-image pass missed.
  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '3')
})

test('ein Bild ohne Gesicht wird trotzdem fertig verarbeitet, statt abzustürzen', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(NO_FACE)

  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done')
  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '0')
  await expect(page.getByTestId('download-all')).toBeEnabled()
})

test('HEIC-Fotos werden über den WASM-Decoder erkannt und verpixelt (Chromium hat kein natives HEIC)', async ({
  page,
}) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN_HEIC)

  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done', { timeout: 15_000 })

  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '1')
  await expect(page.getByTestId('download-all')).toBeEnabled()
})

test('Weichzeichnen-Modus kann statt Verpixeln gewählt werden', async ({ page }) => {
  await page.getByTestId('method-blur').click()
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)

  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done')
  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '1')
})

test('Alle herunterladen erzeugt eine ZIP-Datei mit allen anonymisierten Bildern', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles([EINSTEIN, MONA_LISA])
  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-done-count', '2')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-all').click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^facedrop-.*\.zip$/)
  const downloadPath = await download.path()
  expect(downloadPath).toBeTruthy()
})

test('Effekt-Wechsel nach der Verarbeitung wendet ihn auf alle Bilder an, ohne neu zu erkennen', async ({
  page,
}) => {
  await page.getByTestId('dropzone-input').setInputFiles([EINSTEIN, GROUP_PHOTO])
  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-done-count', '2')

  const items = page.getByTestId('queue-item')
  const firstResultSrc = await items.nth(0).locator('img').getAttribute('src')

  await page.getByTestId('method-blur').click()
  await expect(page.getByTestId('progress-summary')).toHaveText('Effekt wird für alle Bilder aktualisiert …')
  await expect(page.getByTestId('progress-summary')).toHaveText('2 von 2 Bildern anonymisiert')

  // The image was redrawn (new blob URL) …
  await expect(items.nth(0).locator('img')).not.toHaveAttribute('src', firstResultSrc ?? '')
  // … but the same faces were reused rather than re-detected.
  await expect(items.nth(0).getByTestId('face-count')).toHaveAttribute('data-face-count', '1')
  await expect(items.nth(1).getByTestId('face-count')).toHaveAttribute('data-face-count', '3')
})

test('Zurücksetzen leert die Warteschlange wieder', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'done')

  await page.getByTestId('reset').click()

  await expect(page.getByTestId('queue-item')).toHaveCount(0)
  await expect(page.getByTestId('progress-summary')).toHaveCount(0)
})
