require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Question = require('./models/Question');
const seedQuestionsData = require('./utils/questionBank');
const interviewRoutes = require('./routes/interview');
const reportRoutes = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 5001;

// Seed the database with initial questions
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

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/interview', interviewRoutes);
app.use('/api', reportRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected successfully');
    seedDatabase();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export the app for testing purposes
module.exports = app;