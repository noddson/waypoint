import { expect, test, type Locator, type Page } from '@playwright/test'

async function openWaypointMenu(page: Page, mobile: boolean) {
  await page.goto(mobile ? '/?mobile=1' : '/?mobile=0')
  const trigger = page.getByRole('button', { name: 'Open Waypoint menu' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  const dialog = page.getByRole('dialog', { name: 'Waypoint menu' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog.getByRole('navigation', { name: 'Waypoint menu' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Your Trips/ })).toBeFocused()
  return { dialog, trigger }
}

async function expectDesktopDrawer(dialog: Locator, viewport: { width: number; height: number }) {
  const box = await dialog.boundingBox()
  const layoutViewport = await dialog.evaluate(() => ({
    width: document.body.clientWidth,
    height: window.innerHeight,
  }))
  expect(box).not.toBeNull()
  expect(layoutViewport.width).toBeLessThanOrEqual(viewport.width)
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) - layoutViewport.width)).toBeLessThanOrEqual(2)
  expect(box?.y).toBeLessThanOrEqual(2)
  expect(Math.abs((box?.height ?? 0) - layoutViewport.height)).toBeLessThanOrEqual(2)
  expect(box?.width).toBeGreaterThan(350)
  expect(box?.width).toBeLessThanOrEqual(441)
  await expect(dialog).toHaveCSS('border-top-right-radius', '0px')
}

async function expectMobileBottomSheet(dialog: Locator, viewport: { width: number; height: number }) {
  const box = await dialog.boundingBox()
  const layoutViewport = await dialog.evaluate(() => ({
    width: document.body.clientWidth,
    height: window.innerHeight,
  }))
  expect(box).not.toBeNull()
  expect(layoutViewport.width).toBeLessThanOrEqual(viewport.width)
  expect(box?.x).toBeLessThanOrEqual(2)
  expect(Math.abs((box?.width ?? 0) - layoutViewport.width)).toBeLessThanOrEqual(2)
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - layoutViewport.height)).toBeLessThanOrEqual(2)
  expect(box?.y).toBeGreaterThan(0)
  expect(box?.height).toBeLessThanOrEqual(layoutViewport.height * 0.85)
  await expect(dialog).toHaveCSS('border-top-left-radius', '18px')
  await expect(dialog).toHaveCSS('border-bottom-left-radius', '0px')
}

test.describe('unified responsive navigation', () => {
  test('uses a right drawer on desktop and opens Sync & Share accessibly', async ({ page }) => {
    const viewport = { width: 1280, height: 800 }
    await page.setViewportSize(viewport)
    const { dialog, trigger } = await openWaypointMenu(page, false)

    await expectDesktopDrawer(dialog, viewport)
    for (const destination of ['Your Trips', 'Trip Actions', 'Sync & Share', 'Permission Policies', 'Settings']) {
      await expect(dialog.getByRole('button', { name: new RegExp(destination) })).toBeVisible()
    }

    await dialog.getByRole('button', { name: /Sync & Share/ }).click()
    const heading = dialog.getByRole('heading', { name: 'Sync & Share', level: 2 })
    await expect(heading).toBeFocused()
    await expect(dialog.getByRole('heading', { name: 'Google Drive', level: 3 })).toBeVisible()
    await expect(dialog.getByText('Disconnected')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Sync and Update' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toBeFocused()
  })

  test('uses a bottom sheet on mobile and opens Profile from Settings', async ({ page }) => {
    const viewport = { width: 390, height: 844 }
    await page.setViewportSize(viewport)
    const { dialog, trigger } = await openWaypointMenu(page, true)

    await expect(page.locator('body')).toHaveClass(/mobile-experience/)
    await expectMobileBottomSheet(dialog, viewport)

    await dialog.getByRole('button', { name: /Settings/ }).click()
    await dialog.getByRole('button', { name: 'Profile' }).click()
    const heading = dialog.getByRole('heading', { name: 'Profile', level: 2 })
    await expect(heading).toBeFocused()
    await expect(dialog.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to Settings' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Back to Settings' }).click()
    await expect(dialog.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible()
    await dialog.getByRole('button', { name: 'Back to menu' }).click()
    await expect(dialog.getByRole('navigation', { name: 'Waypoint menu' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close menu' }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
