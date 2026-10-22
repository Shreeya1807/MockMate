import { useState } from 'react'
import { extractResume } from '../resume.js'
const sample='Alex Morgan | Software Engineer\nSkills: React, JavaScript, Node.js, SQL, Docker, automated testing.\nBuilt a student scheduling platform with a React dashboard and REST API. Added integration tests and improved slow database queries. Collaborated with a team of four and presented the project to faculty.\nEducation: B.S. Computer Science.'
export default function ResumeUpload({onStart,busy,mode}) {
  const [resume,setResume]=useState(''),[role,setRole]=useState('Software Engineer'),[level,setLevel]=useState('mid')
  const [reading,setReading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[consent,setConsent]=useState(false)
  async function upload(file) {
    if(!file||reading) return
    setReading(true);setError('');setStatus('Opening your resume…')
    try {const text=await extractResume(file,setStatus);setResume(text);setStatus(`${file.name} · ${text.length.toLocaleString()} characters extracted`);if(text.length<50) setError('Not enough text found. Try another file or paste your resume below.')}
    catch(e){setError(e.message);setStatus('')}
    finally{setReading(false)}
  }
  return <div className="setup-grid">
    <section className="card setup-card"><div className="section-heading"><span className="step">01</span><div><h2>Your next opportunity starts here.</h2><p>Give Alex a little context. Get questions that go deeper.</p></div></div>
      <label className={`upload ${reading?'disabled':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files[0])}}>
        <span className="upload-icon">↥</span><strong>{reading?'Reading your resume…':'Drop your resume here'}</strong><span>or browse files · PDF, image, or TXT · up to 5 MB</span>
        <input aria-label="Upload resume" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" disabled={reading||busy} onChange={e=>upload(e.target.files[0])}/>
      </label>
      <div role="status" className="hint">{status||'PDF text extraction + OCR for scanned pages. Review the text below.'}</div>
      {error&&<p role="alert" className="error">{error}</p>}
      <div className="label-row"><label htmlFor="resume">Resume text</label><button className="text-button" disabled={reading||busy} onClick={()=>setResume(sample)}>Try a sample ↗</button></div>
      <textarea id="resume" rows="6" maxLength={24000} value={resume} disabled={reading||busy} onChange={e=>setResume(e.target.value)} placeholder="You can also paste your experience, projects, and skills here…"/>
      <div className="hint right">{resume.length.toLocaleString()} / 24,000 characters</div>
      <div className="form-row"><label>Target role<input value={role} maxLength={100} onChange={e=>setRole(e.target.value)}/></label><label>Experience level<select value={level} onChange={e=>setLevel(e.target.value)}><option value="junior">Early career</option><option value="mid">Mid-level</option><option value="senior">Senior</option></select></label></div>
      <label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to send this text to the MockMate server{mode==='live'?' and its AI provider':''}. Sessions expire after 7 days; I can delete them earlier.</span></label>
      <button className="primary full" disabled={busy||reading||resume.trim().length<50||role.trim().length<2||!consent} onClick={()=>onStart({resume,role,level})}>{busy?'Preparing your interview…':'Build my interview'} <span>→</span></button>
    </section>
    <aside className="setup-aside"><div className="coach-card"><div className="eyebrow">MEET YOUR INTERVIEW COACH</div><div className="avatar">a<span>✦</span></div><h2>A little practice.<br/>A lot more confidence.</h2><p>Alex helps you turn your experience into clear, compelling answers.</p><div className="coach-footer"><span className="status-dot"/> Personalized to your background</div></div>
      <div className="card itinerary"><h3>Your session, at a glance</h3>{[['01','Communication','Explain ideas. Navigate teamwork.'],['02','Technical depth','Make decisions. Explore tradeoffs.'],['03','Your experience','Own the work. Show the impact.']].map(([n,t,d])=><div className="itinerary-row" key={n}><span>{n}</span><div><strong>{t}</strong><p>{d}</p></div><small>2 Qs</small></div>)}<p className="hint">6 questions · Typed or spoken answers · Actionable feedback</p></div>
    </aside>
  </div>
}
