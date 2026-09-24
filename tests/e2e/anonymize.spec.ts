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

test('Manuelle Bearbeitung zeigt Gesichts-Marker, die einzeln von der Anonymisierung ausgenommen werden können', async ({
  page,
}) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'done')

  await page.getByTestId('manual-edit-toggle').click()
  await expect(page.getByTestId('edit-area').locator('img')).toBeVisible()

  const marker = page.getByTestId('face-marker')
  await expect(marker).toHaveAttribute('data-excluded', 'false')
  const srcBefore = await page.getByTestId('edit-area').locator('img').getAttribute('src')

  await marker.click()

  await expect(marker).toHaveAttribute('data-excluded', 'true')
  await expect(page.getByTestId('edit-area').locator('img')).not.toHaveAttribute('src', srcBefore ?? '')

  // Toggling back re-applies the anonymization to that same face.
  await marker.click()
  await expect(marker).toHaveAttribute('data-excluded', 'false')
})

test('Doppelklick fügt ein manuelles Gesicht hinzu, das sich in der Größe anpassen und wieder entfernen lässt', async ({
  page,
}) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'done')

  await page.getByTestId('manual-edit-toggle').click()
  const canvas = page.getByTestId('face-canvas')
  await expect(canvas.locator('img')).toBeVisible()

  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('face-canvas has no bounding box')
  // einstein.jpg is 533x700; the container is much wider (landscape viewport vs. portrait
  // photo), so the rendered photo is letterboxed — replicate the app's object-contain math
  // to land the click on the actual image, near the bottom-left corner away from the face.
  const [naturalWidth, naturalHeight] = [533, 700]
  const scale = Math.min(canvasBox.width / naturalWidth, canvasBox.height / naturalHeight)
  const offsetX = canvasBox.x + (canvasBox.width - naturalWidth * scale) / 2
  const offsetY = canvasBox.y + (canvasBox.height - naturalHeight * scale) / 2
  const addX = offsetX + 40 * scale
  const addY = offsetY + 650 * scale

  await expect(page.getByTestId('manual-face-marker')).toHaveCount(0)
  await page.mouse.dblclick(addX, addY)

  const manualMarker = page.getByTestId('manual-face-marker')
  await expect(manualMarker).toHaveCount(1)
  await expect(manualMarker).toHaveAttribute('data-excluded', 'false')

  // Double-clicking the same spot again (now covered by the marker) doesn't stack a second one.
  await page.mouse.dblclick(addX, addY)
  await expect(manualMarker).toHaveCount(1)

  const markerBoxBefore = await manualMarker.boundingBox()
  if (!markerBoxBefore) throw new Error('manual marker has no bounding box')

  // Drag the resize handle outward to enlarge the circle.
  const handleBox = await page.getByTestId('manual-face-resize-handle').boundingBox()
  if (!handleBox) throw new Error('resize handle has no bounding box')
  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX - 40, handleCenterY - 40, { steps: 10 })
  await page.mouse.move(handleCenterX - 90, handleCenterY - 90, { steps: 10 })
  // Give the pointermove-driven live-resize state a moment to commit before releasing —
  // under load, a burst of synthetic mouse events can otherwise outrun React's render.
  await page.waitForTimeout(100)
  await page.mouse.up()

  await expect
    .poll(async () => (await manualMarker.boundingBox())?.width ?? 0)
    .toBeGreaterThan(markerBoxBefore.width)

  // Toggling the manual marker excludes it from anonymization, same as a detected face.
  await manualMarker.click()
  await expect(manualMarker).toHaveAttribute('data-excluded', 'true')
  await manualMarker.click()
  await expect(manualMarker).toHaveAttribute('data-excluded', 'false')

  // The remove button on the marker deletes it again.
  await page.getByTestId('manual-face-remove').click()
  await expect(page.getByTestId('manual-face-marker')).toHaveCount(0)
})

test('"Manuell bearbeiten" in der Vorschau öffnet die manuelle Bearbeitung direkt mit diesem Bild', async ({
  page,
}) => {
  await page.getByTestId('dropzone-input').setInputFiles([EINSTEIN, GROUP_PHOTO])
  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-done-count', '2')

  // Open the second image's preview and jump straight into manual editing from there.
  await page.getByTestId('queue-item').nth(1).click()
  await expect(page.getByTestId('preview-modal')).toBeVisible()
  await page.getByTestId('preview-edit-manually').click()

  await expect(page.getByTestId('preview-modal')).toHaveCount(0)
  await expect(page.getByTestId('edit-area').locator('img')).toBeVisible()
  await expect(page.getByTestId('face-marker')).toHaveCount(3)
  await expect(page.getByTestId('filmstrip-item').nth(1)).toHaveAttribute('class', /border-primary/)
})

test('"Manuell bearbeiten" wird in der Vorschau auch ohne erkanntes Gesicht angeboten', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(NO_FACE)
  const item = page.getByTestId('queue-item')
  await expect(item).toHaveAttribute('data-status', 'done')
  await expect(item.getByTestId('face-count')).toHaveAttribute('data-face-count', '0')

  await item.click()
  await expect(page.getByTestId('preview-modal')).toBeVisible()
  await expect(page.getByTestId('preview-edit-manually')).toBeVisible()
})

test('Mehr als 25 Bilder auf einmal werden auf die ersten 25 gekürzt, mit Hinweis', async ({ page }) => {
  const thirtyFiles = Array.from({ length: 30 }, () => NO_FACE)
  await page.getByTestId('dropzone-input').setInputFiles(thirtyFiles)

  await expect(page.getByTestId('queue-item')).toHaveCount(25)
  await expect(page.getByTestId('progress-summary')).toHaveAttribute('data-total-count', '25')
  await expect(page.getByTestId('limit-notice')).toContainText('25')

  await page.getByTestId('limit-notice-dismiss').click()
  await expect(page.getByTestId('limit-notice')).toHaveCount(0)
})

test('Zurücksetzen leert die Warteschlange wieder', async ({ page }) => {
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'done')

  await page.getByTestId('reset').click()

  await expect(page.getByTestId('queue-item')).toHaveCount(0)
  await expect(page.getByTestId('progress-summary')).toHaveCount(0)
})
