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
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 900,
    margin: '0 auto',
    padding: '24px 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  progress: { display: 'flex', gap: 6 },
  dot: (active, done) => ({
    width: 28, height: 6, borderRadius: 3,
    background: done ? 'var(--accent)' : active ? 'var(--accent2)' : 'var(--border2)',
    transition: 'background 0.3s',
  }),

  // Video layout
  videoRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginBottom: 20,
  },
  videoCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: '4/3',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transform: 'scaleX(-1)',
  },
  videoLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
  },
  alexAvatar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1f27, #111418)',
    gap: 12,
  },
  alexCircle: (speaking) => ({
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), #7eb3ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    boxShadow: speaking ? '0 0 0 8px rgba(79,142,247,0.3), 0 0 0 16px rgba(79,142,247,0.1)' : 'none',
    transition: 'box-shadow 0.3s',
  }),
  alexName: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
  },
  alexStatus: (speaking) => ({
    fontSize: 12,
    color: speaking ? '#4f8ef7' : '#8b97ab',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }),

  // Mic button
  micRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
    alignItems: 'center',
  },
  micBtn: (listening) => ({
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: listening ? '#e53e3e' : 'var(--accent)',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: listening ? '0 0 0 8px rgba(229,62,62,0.2)' : 'none',
    transition: 'all 0.2s',
  }),
  micLabel: {
    fontSize: 13,
    color: 'var(--text2)',
  },

  // Question + answer
  question: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    marginBottom: 14,
  },
  qMeta: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  qNum: { color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--mono)' },
  qBadge: (cat) => ({
    background: CATEGORY_COLOR[cat] + '22',
    color: CATEGORY_COLOR[cat],
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  }),
  qText: { fontSize: 16, fontWeight: 500, lineHeight: 1.6 },

  answerBox: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    marginBottom: 14,
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.7,
    padding: '12px 14px',
    resize: 'vertical',
    marginBottom: 12,
  },
  btnRow: { display: 'flex', gap: 10 },
  submitBtn: {
    padding: '11px 24px',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    borderRadius: 'var(--radius)',
    transition: 'opacity 0.2s',
  },
  feedback: {
    background: '#3ecf8e11',
    border: '1px solid #3ecf8e44',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 22px',
    marginBottom: 14,
  },
  fbLabel: {
    color: 'var(--green)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  nextBtn: {
    padding: '11px 24px',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    borderRadius: 'var(--radius)',
  },

  // Intro bubble
  interviewer: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    marginBottom: 16,
  },
  bubble: {
    background: 'var(--bg3)',
    borderRadius: '4px 16px 16px 16px',
    padding: '14px 16px',
    lineHeight: 1.7,
    fontSize: 14,
    color: 'var(--text)',
  },
  loader: { display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' },
  loaderDot: (i) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--text2)',
    animation: 'pulse 1.2s ease-in-out infinite',
    animationDelay: `${i * 0.2}s`,
  }),
}

function Loader() {
  return (
    <div style={s.loader}>
      {[0,1,2].map(i => <div key={i} style={s.loaderDot(i)} />)}
    </div>
  )
}

// Clean text before speaking
function cleanForSpeech(text) {
  return text
    // Remove emojis
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[✦★•·→←↑↓]/g, '')
    // Expand common abbreviations
    .replace(/\bAI\b/g, 'A.I.')
    .replace(/\bML\b/g, 'M.L.')
    .replace(/\bLLM\b/g, 'L.L.M.')
    .replace(/\bRAG\b/g, 'R.A.G.')
    .replace(/\bAPI\b/g, 'A.P.I.')
    .replace(/\bSQL\b/g, 'S.Q.L.')
    .replace(/\bUI\b/g, 'U.I.')
    .replace(/\bUX\b/g, 'U.X.')
    .replace(/\bHR\b/g, 'H.R.')
    .replace(/\bCV\b/g, 'C.V.')
    .replace(/\bQ(\d+)\b/g, 'Question $1')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// Speak text using browser Text-to-Speech
function speak(text, onStart, onEnd) {
  window.speechSynthesis.cancel()
  const cleaned = cleanForSpeech(text)
  const utt = new SpeechSynthesisUtterance(cleaned)
  utt.rate   = 1.15
  utt.pitch  = 1.0
  utt.volume = 1

  // Pick best English voice — prioritise Google US English
  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices()
    const preferred = (
      voices.find(v => v.name === 'Google US English') ||
      voices.find(v => v.name.includes('Samantha')) ||
      voices.find(v => v.name.includes('Daniel')) ||
      voices.find(v => v.lang === 'en-US' && !v.name.includes('India')) ||
      voices.find(v => v.lang.startsWith('en') && !v.name.includes('India'))
    )
    if (preferred) utt.voice = preferred
    utt.onstart = () => onStart?.()
    utt.onend   = () => onEnd?.()
    window.speechSynthesis.speak(utt)
  }

  // Voices load async on first call
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = trySpeak
  } else {
    trySpeak()
  }
}

export default function Interview({ resumeText, onFinish }) {
  const [phase, setPhase]           = useState('intro')
  const [intro, setIntro]           = useState('')
  const [questions, setQuestions]   = useState([])
  const [current, setCurrent]       = useState(0)
  const [answer, setAnswer]         = useState('')
  const [feedback, setFeedback]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [answers, setAnswers]       = useState([])
  const [alexSpeaking, setAlexSpeaking] = useState(false)
  const [listening, setListening]   = useState(false)
  const [camError, setCamError]     = useState(false)

  const videoRef    = useRef(null)
  const bottomRef   = useRef(null)
  const recognitionRef = useRef(null)

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCamError(true))
    return () => {
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
      window.speechSynthesis.cancel()
    }
  }, [])

  // Load intro + questions
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
        // Alex speaks the intro first, then the first question after intro finishes
        setTimeout(() => {
          speak(
            introText,
            () => setAlexSpeaking(true),
            () => {
              setAlexSpeaking(false)
              // Speak first question after intro is done
              setTimeout(() => {
                speak(
                  `Question 1 of ${qs.length}. ${qs[0].question}`,
                  () => setAlexSpeaking(true),
                  () => setAlexSpeaking(false)
                )
              }, 800)
            }
          )
        }, 500)
      } catch (e) {
        setIntro('Sorry, I had trouble reading your resume. Please check your API key in src/api.js and try again.\n\nError: ' + e.message)
      }
      setLoading(false)
      setPhase('questions')
    }
    init()
  }, [])

  // Alex speaks each new question (skip 0 — handled after intro)
  useEffect(() => {
    if (phase === 'questions' && questions.length > 0 && current > 0) {
      const q = questions[current]
      if (q) {
        setTimeout(() => {
          speak(`Question ${current + 1} of ${questions.length}. ${q.question}`,
            () => setAlexSpeaking(true),
            () => setAlexSpeaking(false)
          )
        }, 600)
      }
    }
  }, [current, phase, questions.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [intro, feedback, phase])

  // Voice input
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser. Please use Chrome.')
      return
    }
    window.speechSynthesis.cancel()
    setAlexSpeaking(false)
    const recognition = new SpeechRecognition()
    recognition.continuous   = true
    recognition.interimResults = true
    recognition.lang          = 'en-US'
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setAnswer(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const handleSubmit = async () => {
    if (answer.trim().length < 5) return
    stopListening()
    setLoading(true)
    setFeedback('')
    const q = questions[current]
    try {
      const fb = await generateFeedback(q.question, answer, q.category)
      setFeedback(fb)
      setAnswers(prev => [...prev, { question: q, answer, feedback: fb }])
      speak(fb, () => setAlexSpeaking(true), () => setAlexSpeaking(false))
    } catch (e) {
      setFeedback('Could not generate feedback right now. Moving on!')
    }
    setLoading(false)
  }

  const handleNext = () => {
    window.speechSynthesis.cancel()
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

      {/* Video row */}
      <div style={s.videoRow}>
        {/* Alex */}
        <div style={s.videoCard}>
          <div style={s.alexAvatar}>
            <div style={s.alexCircle(alexSpeaking)}>🤖</div>
            <div style={s.alexName}>Alex</div>
            <div style={s.alexStatus(alexSpeaking)}>
              {alexSpeaking ? '🔊 Speaking...' : '● Ready'}
            </div>
          </div>
          <div style={s.videoLabel}>Alex · AI Interviewer</div>
        </div>

        {/* Student webcam */}
        <div style={s.videoCard}>
          {camError ? (
            <div style={{ ...s.alexAvatar }}>
              <div style={{ fontSize: 40 }}>📷</div>
              <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
                Camera not available.<br />Allow camera access to enable video.
              </div>
            </div>
          ) : (
            <video ref={videoRef} style={s.video} autoPlay muted playsInline />
          )}
          <div style={s.videoLabel}>You</div>
        </div>
      </div>

      {/* Intro bubble */}
      <div style={s.interviewer} className="fade-up">
        <div style={s.bubble}>
          {loading && phase === 'intro' ? <Loader /> : intro || <Loader />}
        </div>
      </div>

      {/* Question */}
      {phase === 'questions' && q && (
        <div className="fade-up" key={current}>
          <div style={s.question}>
            <div style={s.qMeta}>
              <span style={s.qNum}>Q{current + 1} / {questions.length}</span>
              <span style={s.qBadge(q.category)}>{CATEGORY_LABEL[q.category]}</span>
            </div>
            <div style={s.qText}>{q.question}</div>
          </div>

          {/* Answer */}
          {!feedback && (
            <div style={s.answerBox}>
              <textarea
                style={s.textarea}
                placeholder={listening ? '🎤 Listening... speak your answer' : 'Type your answer or use the mic below...'}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
              />
              {/* Mic button */}
              <div style={s.micRow}>
                <button
                  style={s.micBtn(listening)}
                  onClick={listening ? stopListening : startListening}
                  title={listening ? 'Stop recording' : 'Start voice input'}
                >
                  {listening ? '⏹' : '🎤'}
                </button>
                <span style={s.micLabel}>
                  {listening ? 'Tap to stop · speak your answer' : 'Tap to answer by voice'}
                </span>
              </div>
              <div style={s.btnRow}>
                <button
                  style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Analysing...' : 'Submit Answer →'}
                </button>
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={s.feedback} className="fade-up">
              <div style={s.fbLabel}>✦ Alex's Feedback</div>
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>{feedback}</div>
              <div style={{ marginTop: 14 }}>
                <button style={s.nextBtn} onClick={handleNext}>
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
