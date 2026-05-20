import React, { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '48px 40px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  logoIcon: {
    width: 40,
    height: 40,
    background: 'var(--accent)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  logoSub: {
    fontSize: 12,
    color: 'var(--text2)',
    fontWeight: 400,
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    marginBottom: 8,
  },
  sub: {
    color: 'var(--text2)',
    fontSize: 15,
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text2)',
    marginBottom: 8,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  tab: (active) => ({
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border2)',
    background: active ? 'var(--accent)' : 'var(--bg3)',
    color: active ? '#fff' : 'var(--text2)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  textarea: {
    width: '100%',
    minHeight: 220,
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.7,
    padding: '16px',
    resize: 'vertical',
    transition: 'border-color 0.2s',
  },
  dropzone: (dragging) => ({
    width: '100%',
    minHeight: 220,
    background: dragging ? 'var(--accent)11' : 'var(--bg3)',
    border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: 24,
  }),
  dropIcon: {
    fontSize: 40,
  },
  dropText: {
    color: 'var(--text2)',
    fontSize: 15,
    textAlign: 'center',
  },
  dropHint: {
    color: 'var(--text3)',
    fontSize: 13,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--bg3)',
    border: '1px solid var(--accent)',
    borderRadius: 8,
    padding: '10px 14px',
    marginTop: 12,
    fontSize: 14,
  },
  chips: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    margin: '16px 0 24px',
  },
  chip: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 13,
    color: 'var(--text2)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
    borderRadius: 'var(--radius)',
    transition: 'opacity 0.2s, transform 0.1s',
    letterSpacing: '0.2px',
  },
  extracting: {
    textAlign: 'center',
    color: 'var(--text2)',
    fontSize: 14,
    padding: '20px 0',
  }
}

const SAMPLE = `John Doe | Software Engineer
Email: john@email.com | LinkedIn: linkedin.com/in/johndoe

SKILLS
JavaScript, React, Node.js, Python, SQL, REST APIs, Git

EXPERIENCE
Junior Developer — TechStartup Inc. (2023–Present)
• Built 3 React dashboards used by 500+ daily users
• Integrated Stripe payment API reducing checkout errors by 40%

Intern — WebAgency Co. (2022)
• Assisted in migrating legacy PHP app to Node.js

EDUCATION
B.E. Computer Engineering — Pune University (2024)`

export default function ResumeUpload({ onStart }) {
  const [tab, setTab]         = useState('pdf')   // 'pdf' | 'text'
  const [resume, setResume]   = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [hovered, setHovered] = useState(false)

  const extractPDF = async (file) => {
    setExtracting(true)
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(item => item.str).join(' ') + '\n'
      }
      setResume(text.trim())
    } catch (e) {
      alert('Could not read PDF. Try a different file or paste your resume as text.')
    }
    setExtracting(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') extractPDF(file)
    else alert('Please drop a PDF file.')
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) extractPDF(file)
  }

  const handleStart = () => {
    if (resume.trim().length < 50) {
      alert('Please upload your resume or paste at least a few lines.')
      return
    }
    onStart(resume.trim())
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card} className="fade-up">

        <div style={styles.logo}>
          <div style={styles.logoIcon}>🎯</div>
          <div>
            <div style={styles.logoText}>MockMate</div>
            <div style={styles.logoSub}>AI Interview Coach</div>
          </div>
        </div>

        <h1 style={styles.heading} className="fade-up-1">Ready to ace your interview?</h1>
        <p style={styles.sub} className="fade-up-1">
          Upload your resume and MockMate will run a personalised mock interview — just like the real thing.
        </p>

        {/* Tabs */}
        <div style={styles.tabRow} className="fade-up-2">
          <button style={styles.tab(tab === 'pdf')}  onClick={() => setTab('pdf')}>📄 Upload PDF</button>
          <button style={styles.tab(tab === 'text')} onClick={() => setTab('text')}>✏️ Paste Text</button>
        </div>

        {/* PDF Upload */}
        {tab === 'pdf' && (
          <div className="fade-up-2">
            <div
              style={styles.dropzone(dragging)}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('pdf-input').click()}
            >
              <div style={styles.dropIcon}>📄</div>
              <div style={styles.dropText}>
                {extracting ? 'Reading your resume...' : 'Drop your PDF here or click to browse'}
              </div>
              <div style={styles.dropHint}>Supports PDF files only</div>
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>
            {fileName && !extracting && (
              <div style={styles.fileInfo}>
                <span>✅</span>
                <span style={{ color: 'var(--text)' }}>{fileName}</span>
                <span style={{ color: 'var(--text2)', marginLeft: 'auto', fontSize: 13 }}>
                  {resume.length} characters extracted
                </span>
              </div>
            )}
            {extracting && (
              <div style={styles.extracting}>⏳ Extracting text from PDF...</div>
            )}
          </div>
        )}

        {/* Text paste */}
        {tab === 'text' && (
          <div className="fade-up-2">
            <textarea
              style={{
                ...styles.textarea,
                borderColor: resume.length > 50 ? 'var(--accent)' : 'var(--border2)',
              }}
              placeholder="Paste your resume text here..."
              value={resume}
              onChange={e => setResume(e.target.value)}
            />
          </div>
        )}

        <div style={styles.chips} className="fade-up-2">
          <span style={styles.chip}>✦ 6 questions</span>
          <span style={styles.chip}>✦ Real-time feedback</span>
          <span style={styles.chip}>✦ 3 categories tested</span>
          {tab === 'text' && (
            <button
              style={{ ...styles.chip, cursor: 'pointer', color: 'var(--accent)' }}
              onClick={() => setResume(SAMPLE)}
            >
              + Load sample resume
            </button>
          )}
        </div>

        <button
          style={{
            ...styles.btn,
            opacity: hovered ? 0.88 : 1,
            transform: hovered ? 'translateY(-1px)' : 'none',
          }}
          className="fade-up-3"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleStart}
        >
          Start Mock Interview →
        </button>

      </div>
    </div>
  )
}
