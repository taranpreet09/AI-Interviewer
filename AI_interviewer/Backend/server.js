// Backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const Session = require('./models/session');
const { buildInterviewerPrompt, callGemini } = require('./utils/aiOrchestrator');
const { finalizeSessionAndStartReport } = require('./services/sessionManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Store sessionId for this socket to handle cleanup on disconnect
  socket.on('join-session', (sessionId) => {
    socket.sessionId = sessionId;
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });

  // --- User Spoke Handler ---
  socket.on('user-spoke', async (data) => {
    const { sessionId, answer } = data;
    if (!sessionId || answer === undefined) {
      return socket.emit('error', { message: 'Invalid data received.' });
    }

    try {
      const session = await Session.findById(sessionId).populate('history.question');
      if (!session) {
        return socket.emit('error', { message: 'Session not found.' });
      }

      // Save user's answer
      session.messages.push({ role: 'user', content: answer });
      const lastItem = session.history[session.history.length - 1];
      if (lastItem && !lastItem.userAnswer) {
        lastItem.userAnswer = answer;
      }

      // Build AI prompt
      const prompt = buildInterviewerPrompt(session, {
        role: session.role,
        recentHistory: session.messages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n'),
        interviewMode: session.interviewMode,
        interviewType: session.interviewType,
        currentStage: session.currentStage
      });

      // Call AI model
      const aiResponse = await callGemini(prompt, session);
      session.messages.push({ role: 'assistant', content: aiResponse.dialogue });

      // ✅ FIX: Check for proper AI end condition
      if (aiResponse.action === 'END_INTERVIEW') {
        console.log(`AI is ending session ${sessionId}.`);
        await session.save();
        await finalizeSessionAndStartReport(sessionId, 'natural_conclusion');
      } else {
        await session.save();
      }

      // Send AI response back to frontend
      socket.emit('ai-spoke', { ...aiResponse, currentStage: session.currentStage });

    } catch (error) {
      console.error("Error processing user speech:", error);
      socket.emit('ai-spoke', {
        action: "CONTINUE",
        dialogue: "I'm sorry, I encountered a small issue. Could you please repeat that?",
        category: "behavioral",
        difficulty: "easy"
      });
    }
  });

  // ✅ ADD: Manual "End Interview" handler
  socket.on('end-interview', async ({ sessionId }) => {
    if (sessionId) {
      console.log(`User manually ended session ${sessionId}. Finalizing.`);
      await finalizeSessionAndStartReport(sessionId, 'user_ended');
    }
  });

  // ✅ FIXED: Proper disconnect handler using stored sessionId
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    if (socket.sessionId) {
      console.log(`Finalizing session ${socket.sessionId} due to disconnect.`);
      await finalizeSessionAndStartReport(socket.sessionId, 'user_ended');
    }
  });
});

// --- API Routes ---
const interviewRoutes = require('./routes/interview');
const reportRoutes = require('./routes/report');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/interview', interviewRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- Database and Server Start ---
const PORT = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
