import React, { useState } from 'react'
import ResumeUpload from './components/ResumeUpload.jsx'
import Interview    from './components/Interview.jsx'
import Results      from './components/Results.jsx'

// App has 3 screens: upload → interview → results
export default function App() {
  const [screen, setScreen]       = useState('upload')   // upload | interview | results
  const [resumeText, setResumeText] = useState('')
  const [answers, setAnswers]     = useState([])

  const handleStart = (text) => {
    setResumeText(text)
    setScreen('interview')
  }

  const handleFinish = (sessionAnswers) => {
    setAnswers(sessionAnswers)
    setScreen('results')
  }

  const handleRestart = () => {
    setResumeText('')
    setAnswers([])
    setScreen('upload')
  }

  return (
    <>
      {screen === 'upload'    && <ResumeUpload onStart={handleStart} />}
      {screen === 'interview' && <Interview resumeText={resumeText} onFinish={handleFinish} />}
      {screen === 'results'   && <Results answers={answers} onRestart={handleRestart} />}
    </>
  )
}
