import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures = (name: string) => path.join(__dirname, '..', 'fixtures', 'images', name)

const EINSTEIN = fixtures('einstein.jpg')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('dropzone-input').setInputFiles(EINSTEIN)
  await expect(page.getByTestId('queue-item')).toHaveAttribute('data-status', 'done')
})

test('klick auf ein Bild öffnet eine größere Vorschau', async ({ page }) => {
  await page.getByTestId('queue-item').click()

  const modal = page.getByTestId('preview-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('einstein.jpg')
  await expect(modal).toContainText('1 Gesicht')
  await expect(modal.locator('img')).toBeVisible()
})

test('Vorschau lässt sich über den Schließen-Button schließen', async ({ page }) => {
  await page.getByTestId('queue-item').click()
  await expect(page.getByTestId('preview-modal')).toBeVisible()

  await page.getByTestId('preview-modal-close').click()

  await expect(page.getByTestId('preview-modal')).toBeHidden()
})

test('Vorschau lässt sich per Escape-Taste schließen', async ({ page }) => {
  await page.getByTestId('queue-item').click()
  await expect(page.getByTestId('preview-modal')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByTestId('preview-modal')).toBeHidden()
})

test('Vorschau lässt sich per Klick auf den Hintergrund schließen', async ({ page }) => {
  await page.getByTestId('queue-item').click()
  const modal = page.getByTestId('preview-modal')
  await expect(modal).toBeVisible()

  // Click near the top-left corner of the overlay, away from the image and caption.
  const box = await modal.boundingBox()
  if (!box) throw new Error('modal has no bounding box')
  await page.mouse.click(box.x + 10, box.y + 10)

  await expect(modal).toBeHidden()
})

test('Klick auf das Bild selbst schließt die Vorschau ebenfalls', async ({ page }) => {
  await page.getByTestId('queue-item').click()
  const modal = page.getByTestId('preview-modal')
  await expect(modal).toBeVisible()

  await modal.locator('img').click()

  await expect(modal).toBeHidden()
})
