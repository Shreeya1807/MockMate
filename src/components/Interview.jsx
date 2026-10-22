import { useEffect, useRef, useState } from 'react'
import MediaPanel from './MediaPanel.jsx'
export default function Interview({ session, onSubmit, busy, config, onReport }) {
  const [current, setCurrent] = useState(0),
    [drafts, setDrafts] = useState({}),
    [listening, setListening] = useState(false),
    [notice, setNotice] = useState('')
  const recognition = useRef(null)
  const answer = drafts[current] || ''
  const setAnswer = (value) => setDrafts((previous) => ({ ...previous, [current]: value }))
  useEffect(
    () => () => {
      recognition.current?.abort()
      window.speechSynthesis?.cancel()
    },
    [],
  )
  const planJob = session.jobs.find((j) => j.kind === 'plan')
  if (!session.plan)
    return (
      <section className="card loading-card">
        <div className="orb">✦</div>
        <h2>
          {planJob?.status === 'failed'
            ? 'We couldn’t prepare this interview.'
            : 'Alex is preparing your interview.'}
        </h2>
        <p>
          {planJob?.status === 'failed'
            ? `The provider could not complete the request (${planJob.error}). Create a new session after checking your provider configuration.`
            : 'Your resume is in the queue. This page updates automatically.'}
        </p>
        <span className="pill">
          {planJob?.status} · attempt {planJob?.attempts || 0} / 3
        </span>
      </section>
    )
  const q = session.plan.questions[current],
    job = session.jobs.find((j) => j.kind === 'evaluation' && j.questionId === q.id)
  const completed = session.jobs.filter(
    (j) => j.kind === 'evaluation' && j.status === 'completed',
  ).length
  function dictate() {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setNotice('Speech recognition is unavailable here. You can type your answer.')
      return
    }
    window.speechSynthesis?.cancel()
    const r = new SpeechRecognition(),
      prefix = answer
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) =>
      setAnswer(
        `${prefix} ${Array.from(e.results)
          .map((x) => x[0].transcript)
          .join(' ')}`
          .trim()
          .slice(0, 8000),
      )
    r.onerror = (e) => {
      setNotice(`Microphone: ${e.error}. Typed answers are always available.`)
      setListening(false)
    }
    r.onend = () => setListening(false)
    recognition.current = r
    try {
      r.start()
      setListening(true)
      setNotice('Speech recognition may be processed by your browser’s speech service.')
    } catch {
      setNotice('Microphone could not start.')
    }
  }
  function readQuestion() {
    if (!window.speechSynthesis) {
      setNotice('Text-to-speech is unavailable in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(q.question))
  }
  return (
    <>
      <div className="session-top">
        <div>
          <span className="eyebrow">
            {session.level} · {session.role}
          </span>
          <h2>Make your experience speak.</h2>
        </div>
        <span className="pill">{completed} / 6 evaluated</span>
      </div>
      <div className="interview-grid">
        <section className="card question-card">
          <div className="question-nav">
            {session.plan.questions.map((item, i) => (
              <button
                aria-label={`Question ${i + 1}`}
                aria-current={current === i ? 'step' : undefined}
                className={current === i ? 'selected' : ''}
                key={item.id}
                onClick={() => {
                  recognition.current?.abort()
                  window.speechSynthesis?.cancel()
                  setCurrent(i)
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="intro">{session.plan.introduction}</p>
          <div className="label-row">
            <span className="tag">{q.category}</span>
            <button className="text-button" onClick={readQuestion}>
              Read aloud ♬
            </button>
          </div>
          <h2 className="question-text">{q.question}</h2>
          {!job && (
            <>
              <label htmlFor="answer">Your answer</label>
              <textarea
                id="answer"
                rows="8"
                maxLength={8000}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Set the scene. Explain your actions. Share the result."
              />
              <div className="label-row">
                <button onClick={dictate}>{listening ? 'Stop dictation' : 'Use microphone'}</button>
                <small>{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</small>
              </div>
              <p className="hint" role="status">
                {notice}
              </p>
              <button
                className="primary full"
                disabled={busy || answer.trim().length < 5}
                onClick={() => {
                  recognition.current?.stop()
                  onSubmit(q.id, answer)
                }}
              >
                {busy ? 'Submitting…' : 'Get feedback →'}
              </button>
            </>
          )}
          {job && job.status !== 'completed' && (
            <div role="status" className="feedback">
              <h3>
                {job.status === 'failed'
                  ? 'Evaluation unavailable'
                  : 'Your answer is being evaluated'}
              </h3>
              <p>
                {job.status === 'failed'
                  ? `The request failed after ${job.attempts} attempt(s): ${job.error}. Your submission is saved; you can continue to the other questions.`
                  : `Status: ${job.status}. Attempt ${job.attempts} of 3. You can continue while the worker processes your answer.`}
              </p>
              <details>
                <summary>Your submitted answer</summary>
                <p>{job.submission?.answer}</p>
              </details>
            </div>
          )}
          {job?.result && (
            <div className="feedback">
              <div className="label-row">
                <h3>Your feedback</h3>
                <strong className="score">
                  {job.result.score}
                  <small>/100</small>
                </strong>
              </div>
              <h4>What worked</h4>
              <ul>
                {job.result.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <h4>Try next time</h4>
              <ul>
                {job.result.improvements.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <details>
                <summary>Example answer framework</summary>
                <p>{job.result.exampleAnswer}</p>
              </details>
            </div>
          )}
          {job && (
            <button
              className="primary full"
              onClick={() => {
                if (current === 5) onReport()
                else {
                  setCurrent(current + 1)
                }
              }}
            >
              {current === 5 ? 'View session report' : 'Next question →'}
            </button>
          )}
        </section>
        <aside>
          <MediaPanel iceServers={config.iceServers} />
          <div className="card tip">
            <span className="eyebrow">COACH’S NOTE</span>
            <h3>Specific beats impressive.</h3>
            <p>
              Use a real example. Explain your part, why you chose that approach, and what changed
              as a result.
            </p>
            <button className="text-button" onClick={onReport}>
              View progress report ↗
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}
