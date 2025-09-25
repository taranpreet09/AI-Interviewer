require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Question = require('./models/Question');
const seedQuestionsData = require('./utils/questionBank');

// --- 1. INITIALIZE APP ---
const app = express();
const PORT = process.env.PORT || 5001;

// --- 2. MIDDLEWARE SETUP ---
// CRITICAL: Middleware must be defined BEFORE you define your routes.
// This tells Express to parse incoming JSON requests before they reach your route handlers.
app.use(cors());
app.use(express.json());

// --- 3. ROUTE DEFINITIONS ---
// CRITICAL: Routes must be defined AFTER the middleware is set up.
const interviewRoutes = require('./routes/interview');
const reportRoutes = require('./routes/report');
const dashboardRoutes = require('./routes/dashboard'); // Assuming you have this file from our discussions

app.use('/api/interview', interviewRoutes);
app.use('/api/report', reportRoutes); 
app.use('/api/dashboard', dashboardRoutes);

// --- 4. DATABASE CONNECTION & SERVER START ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    // Start the server ONLY after the DB connection is successful
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        // Seeding the database can happen after the server starts
        seedDatabase();
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if DB connection fails
  });

// --- HELPER FUNCTION for Seeding Database ---
const seedDatabase = async () => {
  try {
    const count = await Question.countDocuments({ source: 'seed' });
    if (count > 0) {
      console.log('Seed questions already exist in the database.');
      return;
    }
    console.log('Seeding database with initial questions...');
    const questionsToInsert = [];
    for (const category in seedQuestionsData) {
      for (const difficulty in seedQuestionsData[category]) {
        seedQuestionsData[category][difficulty].forEach((q) => {
          questionsToInsert.push({
            text: q.text,
            category: category,
            difficulty: difficulty,
            language_id: q.language_id || null,
            source: 'seed',
            tags: [category],
          });
        });
      }
    }
    await Question.insertMany(questionsToInsert, { ordered: false }).catch(
      (e) => {
        if (e.code !== 11000) console.error('Seeding error:', e);
      }
    );
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

// Export the app for testing purposes
module.exports = app;