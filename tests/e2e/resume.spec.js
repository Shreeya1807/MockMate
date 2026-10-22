import { test, expect } from '@playwright/test'

function pdf(objects) {
  let result = '%PDF-1.4\n',
    offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(result))
    result += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(result)
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  result += offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')
  return Buffer.from(
    `${result}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  )
}
test('PDF resumes are parsed through the bundled PDF worker', async ({ page }) => {
  const content =
    'BT /F1 14 Tf 40 700 Td (Alex Morgan builds React applications with SQL databases and automated tests.) Tj ET'
  const buffer = pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ])
  await page.goto('/')
  await page
    .getByLabel('Upload resume')
    .setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.getByLabel('Resume text')).toHaveValue(/Alex Morgan builds React/)
})
test('image resumes are recognized by the actual OCR worker', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1100
    canvas.height = 250
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 1100, 250)
    ctx.fillStyle = 'black'
    ctx.font = '32px Arial'
    ctx.fillText('Alex Morgan - Software Engineer', 35, 70)
    ctx.fillText('Skills: React, JavaScript, SQL, Docker.', 35, 130)
    ctx.fillText('Built web applications and automated tests.', 35, 190)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Upload resume').setInputFiles({
    name: 'resume.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  })
  await expect(page.getByLabel('Resume text')).toHaveValue(/Alex Morgan/, { timeout: 100000 })
  await expect(page.getByLabel('Resume text')).toHaveValue(/React/)
})
test('scanned PDF pages fall back to OCR', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  const jpg = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 200
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 1000, 200)
    ctx.fillStyle = 'black'
    ctx.font = '32px Arial'
    ctx.fillText('Alex Morgan - React Developer', 30, 65)
    ctx.fillText('Building web applications and automated tests.', 30, 125)
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
  })
  const hex = Buffer.from(jpg, 'base64').toString('hex') + '>'
  const content = 'q 500 0 0 100 40 600 cm /Im1 Do Q'
  const buffer = pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 1000 /Height 200 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`,
  ])
  await page
    .getByLabel('Upload resume')
    .setInputFiles({ name: 'scanned-resume.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.getByLabel('Resume text')).toHaveValue(/Alex Morgan/, { timeout: 100000 })
})
