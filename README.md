# 🤖 AI Interviewer

AI Interviewer is a full-stack web application designed to help job seekers practice for technical and behavioral interviews. It leverages the power of **Google's Gemini API** to create a realistic, interactive, and adaptive interview experience. After the session, users receive a detailed, AI-generated performance report with actionable feedback to help them improve.

---

## ✨ Key Features

- **Conversational AI**: Engage in a natural, back-and-forth conversation with an AI interviewer powered by Google Gemini.  
- **Adaptive Questioning**: The AI adjusts the difficulty and category of questions based on the flow of conversation and the selected interview type.  
- **Multi-Modal Input**: Respond via voice-to-text, direct text input, or through a fully-featured code editor for technical questions.  
- **Live Code Editor & Execution**: Write, run, and test your code for algorithmic challenges directly in the browser using a Monaco-based editor, powered by the Judge0 API.  
- **Detailed AI-Powered Reports**: Upon completion, receive an in-depth performance analysis, including:  
  - An overall summary with strengths, weaknesses, and next steps.  
  - A question-by-question breakdown with scores, AI-generated feedback, and specific tips for improvement.  
  - Analysis of behavioral answers based on the STAR method and other criteria.  
- **Configurable Sessions**: Set up your practice session by choosing a role (e.g., Software Engineer), a target company, and an interview type.  

---

## 🛠️ Technology Stack

### Backend
- Runtime: **Node.js**  
- Framework: **Express.js**  
- Database: **MongoDB with Mongoose**  
- AI: **Google Generative AI (Gemini 1.5 Flash)**  
- Code Execution: **Judge0 API**  
- Environment Variables: **dotenv**  

### Frontend
- Framework: **React**  
- Routing: **React Router**  
- Styling: **Tailwind CSS**  
- API Communication: **Axios**  
- Code Editor: **Monaco Editor (@monaco-editor/react)**  
- Data Visualization: **Recharts**  
- Animations: **Framer Motion**  
- Speech Recognition: **Web Speech API**  
