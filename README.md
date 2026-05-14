# 🎯 MockMate — AI Interview Coach

MockMate is an AI-powered mock interview system that helps students prepare for real interviews. It reads your resume, introduces itself as a professional interviewer (Alex), and tests you across three areas: communication, technical knowledge, and relevant experience.

## Features

- 📄 Resume-aware questions — tailored to YOUR background
- 🤖 AI interviewer (Alex) that introduces itself naturally
- 💬 Real-time feedback after every answer
- 📊 End-of-interview summary with full breakdown
- ✨ Clean, professional dark-mode UI

## Getting Started

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/mockmate.git
cd mockmate
npm install
```

### 2. Set up your API key
```bash
cp .env.example .env
```
Open `.env` and replace `your_api_key_here` 

### 3. Run the app
```bash
npm run dev
```
Open http://localhost:5173 in your browser.

## Project Structure
```
src/
  api.js                  ← All Claude AI calls live here
  App.jsx                 ← Main app, manages screens
  components/
    ResumeUpload.jsx      ← Screen 1: paste your resume
    Interview.jsx         ← Screen 2: the actual interview
    Results.jsx           ← Screen 3: end summary
```

## Built With
- React + Vite
- API

---
Built as a learning project. Day 1 of 5.
