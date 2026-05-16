const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || 'YOUR_OPENROUTER_KEY_HERE'
const MODEL   = 'openrouter/free'
const BASE    = 'https://openrouter.ai/api/v1/chat/completions'

async function callGemini(systemPrompt, userMessage) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'OpenRouter API request failed')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ── 1. Generate interviewer introduction based on resume ──────────────────────
export async function generateIntroduction(resumeText) {
  const system = `You are MockMate's AI interviewer. Your name is Alex.
You are a warm, professional HR interviewer at a top tech company.
Read the candidate's resume carefully and introduce yourself naturally.
Then briefly mention what you noticed in their background (2-3 specific things).
Finally, tell them the interview has 6 questions: 2 on communication, 2 on technical skills, 2 on experience.
Keep it under 120 words. Sound human, not robotic. Do NOT use bullet points.`

  return callGemini(system, `Here is the candidate's resume:\n\n${resumeText}`)
}

// ── 2. Generate all 6 interview questions from resume ─────────────────────────
export async function generateQuestions(resumeText) {
  const system = `You are MockMate's AI question generator.
Based on the resume, generate exactly 6 interview questions as a JSON array.
Format: [
  { "id": 1, "category": "communication",  "question": "..." },
  { "id": 2, "category": "communication",  "question": "..." },
  { "id": 3, "category": "technical",      "question": "..." },
  { "id": 4, "category": "technical",      "question": "..." },
  { "id": 5, "category": "experience",     "question": "..." },
  { "id": 6, "category": "experience",     "question": "..." }
]
Rules:
- Communication questions test how they explain things, handle conflict, teamwork
- Technical questions must be specific to the skills on the resume
- Experience questions must reference actual projects or roles on the resume
- Each question should be 1-2 sentences max
- Return ONLY valid JSON, no extra text, no markdown fences`

  const raw = await callGemini(system, `Resume:\n\n${resumeText}`)
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── 3. Give real-time feedback on each answer ─────────────────────────────────
export async function generateFeedback(question, answer, category) {
  const system = `You are MockMate's real-time feedback coach.
The candidate just answered an interview question.
Give short, specific, encouraging feedback in 2-3 sentences.
Mention one thing they did well and one thing to improve.
Be warm and constructive, like a mentor — not a judge.
Category being tested: ${category}`

  return callGemini(system, `Question: ${question}\n\nAnswer: ${answer}`)
}