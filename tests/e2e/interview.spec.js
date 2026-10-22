import { test, expect } from '@playwright/test'
test('resume to report, history, export and deletion', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByText('You’re in demo mode.')).toBeVisible()
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Build my interview' }).click()
  for (let i = 0; i < 6; i++) {
    await page
      .getByLabel('Your answer', { exact: true })
      .fill(
        'I built a React dashboard for a team of four. I added integration tests and measured a 20 percent reduction in reported errors.',
      )
    await page.getByRole('button', { name: 'Get feedback' }).click()
    await expect(page.getByRole('heading', { name: 'Your feedback', exact: true })).toBeVisible()
    await page
      .getByRole('button', { name: i === 5 ? 'View session report' : 'Next question' })
      .click()
  }
  await expect(page.getByText('6 of 6 answers evaluated')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON report' }).click()
  expect((await download).suggestedFilename()).toMatch(/mockmate-report/)
  await page.reload()
  await page.getByRole('button', { name: 'Session history' }).click()
  await page.getByRole('button', { name: 'Open report' }).first().click()
  await expect(page.getByText('6 of 6 answers evaluated')).toBeVisible()
  await page.getByRole('button', { name: 'Session history' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
  await expect(page.getByText('Your first session is a fresh start.')).toBeVisible()
  expect(errors).toEqual([])
})
test('mobile layout and text file extraction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Upload resume').setInputFiles({
    name: 'resume.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Built React and Node.js applications, SQL APIs and regression tests for a university scheduling project.',
    ),
  })
  await expect(page.getByLabel('Resume text')).toHaveValue(/Built React/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('two browsers establish a real WebRTC connection', async ({ page, context }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Build my interview' }).click()
  await page.getByRole('button', { name: 'Invite a practice partner' }).click()
  const invite = page.getByLabel('Private video invite')
  await expect(invite).toBeVisible()
  const guest = await context.newPage()
  await guest.goto(await invite.inputValue())
  await guest.getByRole('button', { name: 'Join video interview' }).click()
  await expect(page.getByText('Peer connection: connected', { exact: true })).toBeVisible()
  await expect(guest.getByText('Peer connection: connected', { exact: true })).toBeVisible()
  await guest.getByRole('button', { name: 'Leave / stop camera' }).click()
  await expect(page.getByText('Your partner left.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Leave / stop camera' }).click()
})
test('studio is readable at desktop size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Build my interview' })).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true })
})
test('server failures remain visible and preserve resume input', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a sample' }).click()
  await page.getByRole('checkbox').check()
  await page.route('**/api/sessions', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'The queue is full. Try again shortly.' }),
    }),
  )
  await page.getByRole('button', { name: 'Build my interview' }).click()
  await expect(page.getByRole('alert')).toContainText('queue is full')
  await expect(page.getByLabel('Resume text')).toHaveValue(/Alex Morgan/)
})
