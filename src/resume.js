export async function extractResume(file, onProgress = () => {}) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Please choose a file smaller than 5 MB.')
  if (!/\.(pdf|png|jpe?g|txt)$/i.test(file.name))
    throw new Error('Choose a PDF, PNG, JPG, or TXT file.')
  if (/\.txt$/i.test(file.name)) return (await file.text()).slice(0, 24000)
  let worker, pdf, loadingTask
  const recognize = async (image) => {
    if (!worker) {
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('eng', 1, {
        logger: (m) =>
          onProgress(`OCR: ${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ''}`),
      })
    }
    return (await worker.recognize(image)).data.text
  }
  try {
    if (!/\.pdf$/i.test(file.name)) return (await recognize(file)).slice(0, 24000)
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false })
    pdf = await loadingTask.promise
    if (pdf.numPages > 10) throw new Error('Please upload a resume with 10 pages or fewer.')
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`Reading page ${i} of ${pdf.numPages}`)
      const page = await pdf.getPage(i),
        content = await page.getTextContent()
      let pageText = content.items.map((item) => item.str || '').join(' ')
      if (pageText.trim().length < 30) {
        const base = page.getViewport({ scale: 1 }),
          viewport = page.getViewport({
            scale: Math.min(2, 2000 / Math.max(base.width, base.height)),
          })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        pageText = await recognize(canvas)
        canvas.width = 0
        canvas.height = 0
      }
      text += `${pageText}\n`
      page.cleanup()
      if (text.length >= 24000) break
    }
    return text.trim().slice(0, 24000)
  } finally {
    await worker?.terminate()
    await loadingTask?.destroy()
  }
}
