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
    origin: "http://localhost:5173", // Ensures connection from Vite's default port
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
      const session = await Session.findById(sessionId);
      if (!session || session.status === 'completed') {
        return; // Don't process if session is already completed
      }

      // Instead of duplicating logic, we make an internal API call to the existing route
      const internalResponse = await fetch(`http://localhost:${PORT}/api/interview/next-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, answer }),
      });
      
      const responseData = await internalResponse.json();
      socket.emit('ai-spoke', responseData);

    } catch (error) {
      console.error("Error processing user speech:", error);
      socket.emit('ai-spoke', {
        action: "CONTINUE",
        dialogue: "I'm sorry, I encountered a small issue. Could you please repeat that?",
      });
    }
  });

  // --- Manual "End Interview" handler ---
  socket.on('end-interview', async ({ sessionId }) => {
    if (sessionId) {
      console.log(`User manually ended session ${sessionId}. Finalizing.`);
      // Add a brief delay to ensure the last 'user-spoke' event can be processed
      setTimeout(async () => {
          await finalizeSessionAndStartReport(sessionId, 'user_ended');
      }, 1500); // 1.5-second delay
    }
  });

  // --- Disconnect handler using stored sessionId ---
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    if (socket.sessionId) {
      const session = await Session.findById(socket.sessionId);
      // Only abandon if it was ongoing, to prevent issues with completed sessions
      if (session && session.status === 'ongoing') {
        console.log(`Finalizing session ${socket.sessionId} due to disconnect.`);
        await finalizeSessionAndStartReport(socket.sessionId, 'user_ended');
      }
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