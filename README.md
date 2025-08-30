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

---

## 🚀 Getting Started

Follow these instructions to set up and run the project on your local machine.

### Prerequisites
- **Node.js** (v18 or later)  
- **npm** or **yarn**  
- **MongoDB** (a local instance or a free cloud instance from MongoDB Atlas)  
- A **Google AI API Key** for Gemini  
- A **RapidAPI Key** for Judge0  

---

### Installation & Setup

#### 1. Clone the repository
```bash
```
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

## 🔧 Setup Instructions

### 2. Set up the Backend
```bash

cd Backend
npm install
cp .env.example .env

### 🔧 Backend Setup

Open the `.env` file and add your private credentials (see [Configuration](#-configuration)).  

Start the backend server:
```bash
node server.js

➡️ The server should now be running on [http://localhost:5001](http://localhost:5001).  

---

### 🔧 Frontend Setup

Open a new terminal and run:  
```bash
cd Frontend
npm install
npm run dev

➡️ Open your browser and navigate to the URL provided (usually [http://localhost:5173](http://localhost:5173)).  

---

## ⚙️ Configuration

Create a `.env` file inside the **Backend/** directory and add the following keys:  

```ini
# /Backend/.env

# Your MongoDB connection string
MONGO_URI="your_mongodb_connection_string"

# Your API Key from Google AI Studio
GEMINI_API_KEY="your_google_gemini_api_key"

# Your RapidAPI host and key for the Judge0 code execution API
JUDGE0_API_HOST="judge0-ce.p.rapidapi.com"
JUDGE0_API_KEY="your_rapidapi_key_for_judge0"

## ⚠️ Important: API Usage & Development Notes

This project relies heavily on the **Google Gemini API**, which has **free-tier limitations**.

- **Quota Limits**: During intensive testing, you may encounter a `429 Too Many Requests` error.  
  This means you have exceeded the daily free quota. The quota resets every 24 hours.  
  You can monitor your usage in the **Google Cloud Console**.  

- **Development Strategy**: To avoid quota issues, "mock" API responses during development.  
  Modify routes in `/routes/` to return **hard-coded, sample data** instead of live API calls.  
  Use the live API only for **final, end-to-end testing**.  

---

## 📈 Future Improvements

- 🔑 **User Authentication** – Save and track interview history and performance.  
- 📚 **More Interview Types** – Add support for **System Design** and other specialized rounds.  
- 🏢 **Company-Specific Questions** – Practice with questions commonly asked at target companies.  
- 🎥 **Audio/Video Analysis** – Record sessions and provide feedback on pacing, tone, and non-verbal cues.  

---

## 📜 License

This project is licensed under the **MIT License** – feel free to use, modify, and distribute.  
