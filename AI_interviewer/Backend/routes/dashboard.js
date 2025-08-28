// /routes/dashboard.js
// NEW FILE - Provides analytics data for a given session

const express = require('express');
const router = express.Router();
const Session = require('../models/session');

router.get('/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId);
        if (!session || !session.history || session.history.length === 0) {
            return res.status(404).json({ message: 'Analytics data not found for this session.' });
        }

        const confidenceData = [];
        const timeData = [];
        let correctCount = 0;
        let incorrectCount = 0;

        session.history.forEach((item, index) => {
            // Confidence Trend (for behavioral questions)
            if (item.question.type === 'behavioral' && item.analysis) {
                confidenceData.push({
                    question: `Q${index + 1}`,
                    score: item.analysis.confidence || 0,
                });
            }

            // Time per Question
            if (item.timestampStart && item.timestampEnd) {
                const timeTaken = (new Date(item.timestampEnd) - new Date(item.timestampStart)) / 1000; // in seconds
                timeData.push({
                    question: `Q${index + 1} (${item.question.type})`,
                    time: timeTaken,
                });
            }
            
            // Coding Accuracy
            if (item.question.type === 'coding' && item.analysis) {
                if (item.analysis.score > 3) { // Assuming score > 3 means correct
                    correctCount++;
                } else {
                    incorrectCount++;
                }
            }
        });
        
        const accuracyData = [
            { name: 'Correct', value: correctCount },
            { name: 'Incorrect', value: incorrectCount },
        ];

        res.json({ confidenceData, timeData, accuracyData });

    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard data', error: error.message });
    }
});

module.exports = router;