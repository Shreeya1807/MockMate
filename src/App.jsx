import { useEffect, useState } from 'react'
import { api, send } from './api.js'
import ResumeUpload from './components/ResumeUpload.jsx'
import Interview from './components/Interview.jsx'
import Results from './components/Results.jsx'
import MediaPanel from './components/MediaPanel.jsx'
export default function App() {
  const [config, setConfig] = useState(null),
    [view, setView] = useState('practice'),
    [session, setSession] = useState(null),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const room = new URLSearchParams(location.search).get('room')
  useEffect(() => {
    api('/config')
      .then(setConfig)
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    if (!session?.id) return
    let disposed = false,
      controller = new AbortController()
    const poll = async () => {
      try {
        const data = await api(`/sessions/${session.id}`, { signal: controller.signal })
        if (!disposed) setSession(data)
      } catch (e) {
        if (!disposed) setError(e.message)
      }
    }
    const pending = session.jobs.some((j) => ['queued', 'running'].includes(j.status))
    if (!pending) return
    const timer = setInterval(poll, 2000)
    return () => {
      disposed = true
      controller.abort()
      clearInterval(timer)
    }
  }, [session?.id, session?.plan, session?.jobs])
  async function action(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function start(input) {
    await action(async () => {
      const created = await send('/sessions', input)
      setSession(await api(`/sessions/${created.id}`))
      setView('interview')
    })
  }
  async function submit(questionId, answer) {
    await action(async () => {
      await send(`/sessions/${session.id}/answers`, { questionId, answer })
      setSession(await api(`/sessions/${session.id}`))
    })
  }
  async function showHistory() {
    setView('history')
    await action(async () => setHistory(await api('/sessions')))
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="MockMate home">
          <span className="brand-icon">
            m<span>✦</span>
          </span>
          mockmate<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">YOUR PRACTICE SPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={view !== 'history' ? 'active' : ''}
            onClick={() => {
              setView(session ? 'interview' : 'practice')
              setError('')
            }}
          >
            <span>◈</span> Interview studio
          </button>
          <button className={view === 'history' ? 'active' : ''} onClick={showHistory}>
            <span>▤</span> Session history
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className="small-spark">✦</span>
          <h3>Show up prepared.</h3>
          <p>One conversation closer to your next chapter.</p>
          <div className="version">MOCKMATE / 1.0</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{' '}
            <strong>
              {room ? 'Live practice' : view === 'history' ? 'Session history' : 'Interview studio'}
            </strong>
          </span>
          <span className="mode">
            <i />
            {config?.mode === 'live' ? 'AI connected' : config ? 'Demo workspace' : 'Connecting…'}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">PRACTICE WITH PURPOSE</span>
              <h1>
                {view === 'history'
                  ? 'Your practice, in perspective.'
                  : view === 'report'
                    ? 'Reflect. Refine. Repeat.'
                    : 'Your next chapter starts here.'}
              </h1>
              <p>A thoughtful space to practice interviews and sharpen your story.</p>
            </div>
            <span className="edition">
              THE INTERVIEW STUDIO <b>✦</b>
            </span>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}{' '}
              <button
                className="text-button"
                onClick={() => {
                  setError('')
                  if (!config)
                    api('/config')
                      .then(setConfig)
                      .catch((e) => setError(e.message))
                }}
              >
                Retry / dismiss
              </button>
            </div>
          )}
          {config?.mode === 'demo' && (
            <div className="demo-banner">
              <span>✦</span>
              <p>
                <strong>You’re in demo mode.</strong> Explore the full workflow with sample
                feedback. Live AI is enabled through server configuration.
              </p>
              <span className="pill">NO API KEY NEEDED</span>
            </div>
          )}
          {!config && !error && (
            <div className="card" role="status">
              Connecting to the interview service…
            </div>
          )}
          {config && room ? (
            <MediaPanel iceServers={config.iceServers} joinRoom={room} />
          ) : (
            config && (
              <>
                {view === 'practice' && (
                  <ResumeUpload onStart={start} busy={busy} mode={config.mode} />
                )}
                {view === 'interview' && session && (
                  <Interview
                    key={session.id}
                    session={session}
                    onSubmit={submit}
                    busy={busy}
                    config={config}
                    onReport={() => setView('report')}
                  />
                )}
                {view === 'report' && session && (
                  <Results
                    session={session}
                    onContinue={() => setView('interview')}
                    onRestart={() => {
                      setSession(null)
                      setView('practice')
                    }}
                  />
                )}
                {view === 'history' && (
                  <section className="card history">
                    <div className="label-row">
                      <h2>Saved sessions</h2>
                      <button
                        onClick={() => {
                          setSession(null)
                          setView('practice')
                        }}
                      >
                        New interview +
                      </button>
                    </div>
                    <p>
                      Available in this browser for 7 days. Delete a session to remove its answers
                      and jobs.
                    </p>
                    {!history.length && (
                      <div className="empty">
                        <span>↗</span>
                        <h3>Your first session is a fresh start.</h3>
                        <p>Complete a practice interview to build your history.</p>
                      </div>
                    )}
                    {history.map((s) => (
                      <div className="history-row" key={s.id}>
                        <div>
                          <strong>{s.role}</strong>
                          <p>
                            {new Date(s.created).toLocaleDateString()} · {s.mode}
                          </p>
                        </div>
                        <div className="actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                setSession(await api(`/sessions/${s.id}`))
                                setView('report')
                              })
                            }
                          >
                            Open report ↗
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Permanently delete this session and all its answers?',
                                )
                              )
                                action(async () => {
                                  await api(`/sessions/${s.id}`, { method: 'DELETE' })
                                  setHistory(await api('/sessions'))
                                  if (session?.id === s.id) setSession(null)
                                })
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )
          )}
          <footer>
            <span>Built for the work that comes next.</span>
            <span>Resume-aware · Privacy-conscious · Always learning</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
