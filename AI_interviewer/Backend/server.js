require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const interviewRoutes = require('./routes/interview');
const reportRoutes = require('./routes/report');
const feedbackRoutes = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use('/api/interview', interviewRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', reportRoutes);
mongoose.connect(process.env.MONGO_URI, {})
.then(() => {
    console.log('MongoDB connected successfully');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error('MongoDB connection error:', err));