export default function Results({ session, onContinue, onRestart }) {
  const jobs = session.jobs.filter((j) => j.kind === 'evaluation'),
    answers = jobs.filter((j) => j.result).map((j) => j.result)
  const average = (items) =>
    items.length ? Math.round(items.reduce((n, a) => n + a.score, 0) / items.length) : null
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            role: session.role,
            level: session.level,
            mode: session.mode,
            created: session.created,
            completed: answers.length,
            total: 6,
            assessments: answers,
            submissions: jobs.map(({ questionId, status, error, submission }) => ({
              questionId,
              status,
              error,
              ...submission,
            })),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = `mockmate-report-${session.id}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <section className="report-hero card">
        <div>
          <span className="eyebrow">YOUR SESSION REPORT</span>
          <h2>Progress starts with practice.</h2>
          <p>
            {answers.length} of 6 answers evaluated · {session.role}
          </p>
          <p className="hint">
            {session.mode === 'demo'
              ? 'Demo scores are fixed examples, not a measure of interview performance.'
              : 'Automated feedback is coaching guidance. Review its accuracy and use your own judgment.'}
          </p>
        </div>
        <div className="overall">
          {average(answers) ?? '—'}
          <span>average / 100</span>
        </div>
      </section>
      <div className="stats">
        {['communication', 'technical', 'experience'].map((c) => {
          const items = answers.filter((a) => a.question.category === c)
          return (
            <div className="card stat" key={c}>
              <span>{c}</span>
              <strong>
                {average(items) ?? '—'}
                <small>/100</small>
              </strong>
              <div className="meter">
                <i style={{ width: `${average(items) || 0}%` }} />
              </div>
              <small>{items.length} / 2 evaluated</small>
            </div>
          )
        })}
      </div>
      <div className="actions report-actions">
        <button className="primary" onClick={onContinue}>
          Continue interview
        </button>
        <button onClick={download}>Export JSON report ↓</button>
        <button onClick={() => window.print()}>Print / save PDF</button>
        <button onClick={onRestart}>New practice</button>
      </div>
      {jobs
        .filter((j) => j.status !== 'completed')
        .map((j) => (
          <p className="notice" key={j.id}>
            Question {j.questionId}: {j.status}
            {j.error ? ` · ${j.error}` : ''}
          </p>
        ))}
      <h2 className="section-title">Your answer breakdown</h2>
      {answers.length === 0 && (
        <div className="card">
          <p>No evaluated answers yet. Your report will update as jobs finish.</p>
        </div>
      )}
      {answers.map((a, i) => (
        <article className="card answer-card" key={a.question.id}>
          <div className="label-row">
            <span className="tag">{a.question.category}</span>
            <strong>{a.score} / 100</strong>
          </div>
          <h3>
            {i + 1}. {a.question.question}
          </h3>
          <h4>Your answer</h4>
          <p className="preserve">{a.answer}</p>
          <div className="feedback-columns">
            <div>
              <h4>Strengths</h4>
              <ul>
                {a.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Next steps</h4>
              <ul>
                {a.improvements.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          <details>
            <summary>Example answer framework</summary>
            <p>{a.exampleAnswer}</p>
          </details>
        </article>
      ))}
    </>
  )
}
