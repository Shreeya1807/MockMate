import React, { useState } from 'react'

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
  const [resume, setResume] = useState('')
  const [hovered, setHovered] = useState(false)

  const handleStart = () => {
    if (resume.trim().length < 50) {
      alert('Please paste your resume first (at least a few lines).')
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
          Paste your resume below. MockMate will read it and run a personalised mock interview — just like the real thing.
        </p>

        <label style={styles.label} className="fade-up-2">Your Resume</label>
        <textarea
          style={{
            ...styles.textarea,
            borderColor: resume.length > 50 ? 'var(--accent)' : 'var(--border2)',
          }}
          placeholder="Paste your resume text here..."
          value={resume}
          onChange={e => setResume(e.target.value)}
          className="fade-up-2"
        />

        <div style={styles.chips} className="fade-up-2">
          <span style={styles.chip}>✦ 6 questions</span>
          <span style={styles.chip}>✦ Real-time feedback</span>
          <span style={styles.chip}>✦ 3 categories tested</span>
          <button
            style={{ ...styles.chip, cursor: 'pointer', color: 'var(--accent)' }}
            onClick={() => setResume(SAMPLE)}
          >
            + Load sample resume
          </button>
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
