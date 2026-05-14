import React from 'react'

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
  wrap: { minHeight: '100vh', maxWidth: 760, margin: '0 auto', padding: '40px 16px' },
  hero: { textAlign: 'center', marginBottom: 48 },
  trophy: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 700, letterSpacing: '-1px', marginBottom: 8 },
  sub: { color: 'var(--text2)', fontSize: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 36 },
  statCard: (color) => ({
    background: color + '11', border: '1px solid ' + color + '44',
    borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center',
  }),
  statNum: (color) => ({ fontSize: 32, fontWeight: 700, color, marginBottom: 4 }),
  statLabel: { fontSize: 13, color: 'var(--text2)' },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 16, letterSpacing: '-0.3px' },
  answerCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 12,
  },
  badge: (cat) => ({
    display: 'inline-block', background: CATEGORY_COLOR[cat] + '22',
    color: CATEGORY_COLOR[cat], padding: '3px 10px',
    borderRadius: 20, fontSize: 12, fontWeight: 500, marginBottom: 10,
  }),
  qText: { fontWeight: 500, fontSize: 15, marginBottom: 10 },
  divider: { borderTop: '1px solid var(--border)', margin: '12px 0' },
  aLabel: { fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' },
  aText: { fontSize: 14, lineHeight: 1.7, color: 'var(--text)' },
  fbText: { fontSize: 14, lineHeight: 1.7, color: 'var(--green)' },
  restartBtn: {
    padding: '14px 32px', background: 'var(--accent)', color: '#fff',
    fontWeight: 600, fontSize: 15, borderRadius: 'var(--radius)',
    display: 'block', margin: '0 auto', letterSpacing: '0.2px',
  },
}

export default function Results({ answers, onRestart }) {
  const cats = ['communication', 'technical', 'experience']

  return (
    <div style={s.wrap} className="fade-up">

      <div style={s.hero}>
        <div style={s.trophy}>🏆</div>
        <h1 style={s.title}>Interview Complete!</h1>
        <p style={s.sub}>Great work. Here's a summary of your session with Alex.</p>
      </div>

      {/* Stats row */}
      <div style={s.grid}>
        {cats.map(cat => {
          const count = answers.filter(a => a.question.category === cat).length
          return (
            <div key={cat} style={s.statCard(CATEGORY_COLOR[cat])}>
              <div style={s.statNum(CATEGORY_COLOR[cat])}>{count}</div>
              <div style={s.statLabel}>{CATEGORY_LABEL[cat].split(' ')[1]} questions</div>
            </div>
          )
        })}
      </div>

      {/* Detailed breakdown */}
      <div style={s.section}>
        <div style={s.sectionTitle}>📋 Full Interview Breakdown</div>
        {answers.map((item, i) => (
          <div key={i} style={s.answerCard} className="fade-up">
            <span style={s.badge(item.question.category)}>{CATEGORY_LABEL[item.question.category]}</span>
            <div style={s.qText}>Q{i + 1}: {item.question.question}</div>
            <div style={s.divider} />
            <div style={s.aLabel}>Your Answer</div>
            <div style={s.aText}>{item.answer}</div>
            <div style={s.divider} />
            <div style={s.aLabel}>Alex's Feedback</div>
            <div style={s.fbText}>{item.feedback}</div>
          </div>
        ))}
      </div>

      <button style={s.restartBtn} onClick={onRestart}>
        Practice Again →
      </button>

    </div>
  )
}
