import React, { useState, useEffect, useRef } from 'react'
import { generateIntroduction, generateQuestions, generateFeedback } from '../api.js'

const CATEGORY_COLOR = {
  communication: '#4f8ef7',
  technical:     '#3ecf8e',
  experience:    '#f5a623',
}
const CATEGORY_LABEL = {
  communication: '💬 Communication',
  technical:     '⚙️ Technical',
  experience:    '📁 Experience',
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 760, margin: '0 auto', padding: '24px 16px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  logo: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 8 },
  progress: { display: 'flex', gap: 6 },
  dot: (active, done) => ({
    width: 28, height: 6, borderRadius: 3,
    background: done ? 'var(--accent)' : active ? 'var(--accent2)' : 'var(--border2)',
    transition: 'background 0.3s',
  }),
  interviewer: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', marginBottom: 20,
  },
  avatar: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), #7eb3ff)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, marginBottom: 14,
  },
  alexName: { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  alexTitle: { color: 'var(--text2)', fontSize: 13, marginBottom: 14 },
  bubble: {
    background: 'var(--bg3)', borderRadius: '4px 16px 16px 16px',
    padding: '16px 18px', lineHeight: 1.7, fontSize: 15, color: 'var(--text)',
  },
  loader: { display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' },
  loaderDot: (i) => ({
    width: 8, height: 8, borderRadius: '50%', background: 'var(--text2)',
    animation: 'pulse 1.2s ease-in-out infinite',
    animationDelay: `${i * 0.2}s`,
  }),
  question: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 16,
  },
  qMeta: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  qNum: { color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--mono)' },
  qBadge: (cat) => ({
    background: CATEGORY_COLOR[cat] + '22', color: CATEGORY_COLOR[cat],
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
  }),
  qText: { fontSize: 17, fontWeight: 500, lineHeight: 1.6, letterSpacing: '-0.2px' },
  answerBox: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 16,
  },
  textarea: {
    width: '100%', minHeight: 120, background: 'var(--bg3)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
    color: 'var(--text)', fontSize: 15, lineHeight: 1.7,
    padding: '14px 16px', resize: 'vertical', marginBottom: 14,
  },
  submitBtn: {
    padding: '12px 28px', background: 'var(--accent)', color: '#fff',
    fontWeight: 600, fontSize: 14, borderRadius: 'var(--radius)',
    transition: 'opacity 0.2s', letterSpacing: '0.2px',
  },
  feedback: {
    background: '#3ecf8e11', border: '1px solid #3ecf8e44',
    borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 16,
  },
  fbLabel: { color: 'var(--green)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' },
  nextBtn: {
    padding: '12px 28px', background: 'var(--bg3)',
    border: '1px solid var(--border2)', color: 'var(--text)',
    fontWeight: 600, fontSize: 14, borderRadius: 'var(--radius)',
    marginLeft: 10, transition: 'border-color 0.2s',
  },
}

function Loader() {
  return (
    <div style={s.loader}>
      {[0,1,2].map(i => <div key={i} style={s.loaderDot(i)} />)}
    </div>
  )
}

export default function Interview({ resumeText, onFinish }) {
  const [phase, setPhase]         = useState('intro')   // intro | questions | done
  const [intro, setIntro]         = useState('')
  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [answer, setAnswer]       = useState('')
  const [feedback, setFeedback]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [answers, setAnswers]     = useState([])
  const bottomRef = useRef(null)

  // Auto-scroll on new content
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [intro, feedback, phase])

  // Start: load intro + questions together
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [introText, qs] = await Promise.all([
          generateIntroduction(resumeText),
          generateQuestions(resumeText),
        ])
        setIntro(introText)
        setQuestions(qs)
      } catch (e) {
        setIntro('Sorry, I had trouble reading your resume. Please check your API key in src/api.js and try again.\n\nError: ' + e.message)
      }
      setLoading(false)
      setPhase('questions')
    }
    init()
  }, [])

  const handleSubmit = async () => {
    if (answer.trim().length < 10) return
    setLoading(true)
    setFeedback('')
    const q = questions[current]
    try {
      const fb = await generateFeedback(q.question, answer, q.category)
      setFeedback(fb)
      setAnswers(prev => [...prev, { question: q, answer, feedback: fb }])
    } catch (e) {
      setFeedback('Could not generate feedback right now. Moving on!')
    }
    setLoading(false)
  }

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      onFinish(answers)
    } else {
      setCurrent(c => c + 1)
      setAnswer('')
      setFeedback('')
    }
  }

  const q = questions[current]

  return (
    <div style={s.wrap}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>🎯 MockMate</div>
        {phase === 'questions' && questions.length > 0 && (
          <div style={s.progress}>
            {questions.map((_, i) => (
              <div key={i} style={s.dot(i === current, i < current)} />
            ))}
          </div>
        )}
      </div>

      {/* Alex's intro bubble */}
      <div style={s.interviewer} className="fade-up">
        <div style={s.avatar}>🤖</div>
        <div style={s.alexName}>Alex</div>
        <div style={s.alexTitle}>AI Interviewer · MockMate</div>
        <div style={s.bubble}>
          {loading && phase === 'intro' ? <Loader /> : intro || <Loader />}
        </div>
      </div>

      {/* Questions section */}
      {phase === 'questions' && q && (
        <div className="fade-up" key={current}>

          {/* Question card */}
          <div style={s.question}>
            <div style={s.qMeta}>
              <span style={s.qNum}>Q{current + 1} / {questions.length}</span>
              <span style={s.qBadge(q.category)}>{CATEGORY_LABEL[q.category]}</span>
            </div>
            <div style={s.qText}>{q.question}</div>
          </div>

          {/* Answer box */}
          {!feedback && (
            <div style={s.answerBox}>
              <textarea
                style={s.textarea}
                placeholder="Type your answer here..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                autoFocus
              />
              <button
                style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Analysing...' : 'Submit Answer →'}
              </button>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={s.feedback} className="fade-up">
              <div style={s.fbLabel}>✦ Alex's Feedback</div>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>{feedback}</div>
              <div style={{ marginTop: 16 }}>
                <button style={s.submitBtn} onClick={handleNext}>
                  {current + 1 >= questions.length ? 'See My Results →' : 'Next Question →'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
