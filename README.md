# AI Interviewer

AI Interviewer is a full‑stack, AI‑powered mock interview platform. It simulates a realistic interviewer that:

- Adapts questions based on your performance and emotional signals  
- Supports **voice‑based conversations** with a talking “AI avatar”  
- Evaluates **behavioral, theory, and coding** answers using LLMs (Gemini)  
- Runs your **code solutions** via Judge0  
- Generates **recruiter‑style reports** and **analytics dashboards** after each session  

Use it to prepare for behavioral, system design, coding, and technical screen interviews.

---

## Features

### Interview Experience

- **Interview modes**
  - **Specific Round**: Focused session (Behavioral, System Design, Coding Challenge, Technical Screen)
  - **Full Interview**: Multi‑stage simulation (intro → technical deep dive → behavioral wrap‑up)
- **Personalized greeting & flow**
  - Tailors questions to:
    - Target role and company
    - Free‑text “candidate background” (e.g., resume summary)
  - Tracks conversation **memory**: previous experiences, technical topics, emotional cues
- **Adaptive difficulty**
  - Automatically adjusts question difficulty (`easy`/`medium`/`hard`) based on recent scores and sentiment
  - Uses transitions like “You’re doing great – let’s dive deeper…” when ramping up

### Voice & Interaction

- **Real‑time voice interview**
  - Uses browser speech recognition for your answers
  - Uses browser speech synthesis to speak AI responses
  - Attempts to pick an Indian English male voice for a more “human” interviewer feel
- **Live AI avatar panel**
  - Animated state when AI is speaking
  - Typing‑style text reveal for AI responses
- **Fallbacks**
  - If mic is unavailable, fall back to text answers
  - For coding questions, a built‑in code editor takes over

### Coding Evaluation

- **Embedded code editor**
  - Based on `@monaco-editor/react`
  - Lets you write and submit solutions for coding questions
- **Remote execution via Judge0**
  - Sends code to Judge0 via RapidAPI (`JUDGE0_API_HOST` / `JUDGE0_API_KEY`)
  - Returns execution status and messages
  - Frontend uses this to provide contextual feedback like "code executed successfully" vs “there might be an issue”

### AI Evaluation & Reports

- **LLM‑powered answer evaluation (Gemini)**
  - **Behavioral**: STAR structure, detail, impact, learning
  - **Theory**: correctness, completeness, clarity vs an ideal answer (when available)
  - **Coding**: structure, readability, logic, and potential efficiency (no full correctness testing here)
- **Heuristic fallbacks**
  - If Gemini fails or times out, heuristic scoring kicks in (length, structure, keywords)
- **Background worker for reports**
  - Uses **BullMQ** + **Redis** to process reports asynchronously
  - Aggregates question‑by‑question scores into:
    - Overall score (0–5)
    - Category scores (behavioral, theory/design, coding)
    - Detailed feedback with tips per question
- **Recruiter‑style summary**
  - Strengths
  - Weaknesses
  - Next steps / action items

### Analytics Dashboard

- **Per‑session analytics (`/dashboard/:sessionId`)**
  - Performance trend line (score per question)
  - Time‑per‑question bar chart
  - Questions‑by‑category pie chart
  - Summary metrics:
    - Total questions
    - Average score
    - Time efficiency classification (Fast / Normal / Deliberate)
    - Consistency classification (Consistent / Moderate / Variable)

### Frontend UX

- Built with **React + Vite + Tailwind CSS**
- Main flows:
  - **Home Page**: choose interview mode, interview type (when specific), target role/company, and optional background text
  - **Interview Room**: AI avatar + your camera feed + voice or code editor, with real‑time updates via Socket.IO
  - **Report Page**: radar chart, recruiter summary, and detailed per‑question feedback cards
  - **Dashboard**: charts and high‑level metrics for a given session

---

## Tech Stack

### Frontend

- **React 19** (Vite)
- **React Router** for routing
- **Tailwind CSS** for styling
- **Socket.IO client** for real‑time interview flow
- **react‑speech‑recognition** + Web Speech API for voice
- **@monaco-editor/react** for the coding editor
- **Recharts** for analytics visualizations
- **Framer Motion** for animations
- **Vitest** + Testing Library for tests

### Backend

- **Node.js / Express 5**
- **MongoDB + Mongoose** for persistence
- **Socket.IO** (server) for real‑time events:
  - `user-spoke` → AI responds
  - `ai-spoke` → client consumes AI response
  - `end-interview` / disconnect handling
- **AI integrations**
  - **Google Gemini** via `@google/generative-ai`
    - Interview orchestration (`aiOrchestrator.js`)
    - Question generation (`aiQuestionGen.js`)
    - Answer evaluation & report summarization (`aiEvaluator.js`)
- **Queue & background processing**
  - **BullMQ** + **ioredis** (`reportWorker.js`) for async report generation
- **Code execution**
  - **Judge0 API** via RapidAPI
- **Testing**
  - **Jest** + **Supertest** + `mongodb-memory-server`

---

## Project Structure

High‑level layout:

```text
AI-Interviewer/
  README.md
  AI_interviewer/
    Backend/
      server.js
      package.json
      routes/
        interview.js      # start interview, next-step, end, code submit, session info
        dashboard.js      # analytics data for a session
        report.js         # create & poll AI report for a session
        feedback.js       # legacy/basic feedback
      utils/
        aiOrchestrator.js # builds prompts, calls Gemini, sentiment & emotion heuristics
        aiQuestionGen.js  # contextual question generation (Gemini)
        aiEvaluator.js    # Gemini-based scoring + heuristic fallbacks and summary
        questionBank.js   # static/fallback question sets
      models/
        Question.js
        session.js
        report.model.js
      services/
        sessionManager.js # finalize session & enqueue report job
        reportWorker.js   # BullMQ worker that builds reports
    Frontend/
      package.json
      src/
        main.jsx
        App.jsx
        pages/
          HomePage.jsx
          InterviewRoom.jsx
          Dashboard.jsx
          ReportPage.jsx
          InterviewSelection.jsx (older selection UI)
        components/
          CodeEditor.jsx
          ChatMessage.jsx
          FeedbackCard.jsx
          ScoreCard.jsx
        hooks/
          useTypewriter.js
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended)
- **npm** (comes with Node)
- **MongoDB** running locally or remotely
- **Redis** instance (for BullMQ report queue)
- **Google Gemini API key**
- **Judge0 via RapidAPI** (or compatible Judge0 endpoint)

### 1. Clone the repo

```bash
git clone <your-repo-url> AI-Interviewer
cd AI-Interviewer/AI_interviewer
```

### 2. Install dependencies

#### Backend

```bash
cd Backend
npm install
```

#### Frontend

```bash
cd ../Frontend
npm install
```

---

## Configuration

Create a `.env` file inside `AI_interviewer/Backend`:

```bash
# Server
PORT=5001

# MongoDB
MONGO_URI=mongodb://localhost:27017/ai-interviewer

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Judge0 (RapidAPI or compatible)
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
```

Notes:

- `PORT` must match what the frontend expects. Currently the backend CORS is configured for `http://localhost:5173`.
- Adjust `MONGO_URI` and `REDIS_URL` for your environment if not running locally.
- `JUDGE0_API_HOST` and `JUDGE0_API_KEY` should come from your RapidAPI Judge0 subscription (or equivalent).

---

## Running the App Locally

Open **two terminals** (or more) from `AI_interviewer`:

### 1. Start the backend

```bash
cd Backend
npm start
```

This will:

- Start the Express server on `http://localhost:5001`
- Connect to MongoDB (`MONGO_URI`)
- Initialize Socket.IO
- Load BullMQ worker (via `reportWorker.js`) and queue integrations

### 2. Start the frontend

```bash
cd Frontend
npm run dev
```

By default Vite runs on `http://localhost:5173`.

Then open the frontend in your browser: `http://localhost:5173`.

---

## Typical Flow

1. **Home Page**
   - Choose:
     - **Preparation mode**: Specific Round or Full Interview
     - **Interview type** (for specific): Behavioral / System Design / Coding Challenge / Technical Screen
     - **Role** (required) and **company** (optional)
     - Paste a **short background** or resume summary (optional)
   - Click **Start Interview**:
     - Calls `POST /api/interview/start`
     - Backend:
       - Creates a `Session`
       - Builds a personalized greeting
       - Returns `sessionId` and greeting
     - Frontend navigates to `/interview/:sessionId`.

2. **Interview Room**
   - On load, it calls `GET /api/interview/session/:sessionId` to pull current session state.
   - Socket.IO:
     - Joins the session room with `join-session`.
     - When you answer:
       - For voice: uses `react-speech-recognition` to capture transcript  
       - For text (fallback) or code: uses input/CodeEditor value  
       - Emits `user-spoke { sessionId, answer }` to the backend.
     - Backend:
       - Updates session history & conversation memory
       - Evaluates answer (Gemini + heuristics)
       - Decides whether to:
         - Continue (generate next question via Gemini / question bank) or
         - End interview (natural conclusion or manually via `end-interview`)
       - Emits `ai-spoke` with `{ action, dialogue, category, currentStage, ... }`.
     - Frontend:
       - Speaks the AI dialogue with the selected voice
       - Updates UI & question count
       - For `END_INTERVIEW`, routes to `/report/:sessionId` after a short delay.

3. **Report Page**
   - On `/report/:sessionId`:
     - Calls `GET /api/report/session/:sessionId`:
       - If a completed report exists → returns 200 with report data.
       - If not:
         - Creates a `Report` document (`pending`)
         - Enqueues a job in BullMQ for `reportWorker` to generate it
         - Returns 202 with `reportId`.
     - If 202, the frontend polls `GET /api/report/status/:reportId` until `status === "completed"` or `failed`.
   - When done, shows:
     - Recruiter summary (strengths, weaknesses, next steps)
     - Radar chart for Behavioral / Theory/Design / Coding
     - Detailed feedback cards per question (optionally grouped by stage for full interviews)
   - Provides links to:
     - Start a new interview
     - View analytics dashboard

4. **Dashboard**
   - `/dashboard/:sessionId` uses `GET /api/dashboard/:sessionId` to show:
     - Performance trend line
     - Time per question bar chart
     - Category breakdown pie chart
     - Summary metrics and classification

---

## API Overview (Summary)

All routes are prefixed with `http://localhost:5001/api`.

### Interview (`/interview`)

- `POST /interview/start`
  - Body: `{ role, company?, interviewType, interviewMode, candidateContext? }`
  - Creates session and returns `{ sessionId, greeting, sessionContext }`.
- `POST /interview/next-step`
  - Body: `{ sessionId, answer }`
  - Records answer, updates memory & difficulty, and returns AI’s next action/dialogue.
- `POST /interview/end/:sessionId`
  - Optional body: `{ finalAnswer?, feedback? }`
  - Marks session completed, stores final feedback, returns closing message and summary.
- `GET /interview/session/:sessionId`
  - Returns session details plus computed metrics (average sentiment, technical breadth, etc.).
- `POST /interview/code/submit`
  - Body: `{ source_code, language_id? }`
  - Submits to Judge0 and returns execution info + helpful message.

### Dashboard (`/dashboard`)

- `GET /dashboard/:sessionId`
  - Returns analytics data for charts and summary.
- `GET /dashboard/:sessionId/progress`
  - Returns minimal progress info (stage, question count, estimated time remaining).

### Reports (`/report`)

- `GET /report/session/:sessionId`
  - Smart entrypoint:
    - Returns 200 with complete report if it exists.
    - Or 202 with `{ reportId }` if generation has been queued.
- `GET /report/status/:reportId`
  - Returns `{ status }` or `{ status, data }` when completed.

---

## Running Tests

### Backend (Jest)

```bash
cd AI_interviewer/Backend
npm test
```

- Uses Jest with `mongodb-memory-server` for isolated DB tests.
- Includes tests for routes (`__tests__` in `routes/`) and utils (`__tests__` in `utils/`).

### Frontend (Vitest + React Testing Library)

```bash
cd AI_interviewer/Frontend
npm run test
```

- Uses Vitest with JSDOM environment.
- Basic setup in `src/setupTests.js`.

---

## Future Improvements / Ideas

You can adapt this section to your roadmap, but some natural next steps include:

- OAuth or simple auth for saving multiple sessions per user
- Multi‑tenant support for different roles/companies
- Configurable question banks and difficulty curves
- Recording & playback of interview video
- Exportable PDF reports and links to share with mentors/recruiters

---
