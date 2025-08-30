const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const Question = require('../models/Question');
const { evaluateBehavioral, evaluateTheory, evaluateCoding, generateFinalSummary } = require('../utils/aiEvaluator');

router.get('/analyze/session/:sessionId', async (req, res) => {

    /*
    // --- MOCK REPORT LOGIC (Temporarily Disabled) ---
    console.log("[DEBUG] Returning a MOCKED report to save API quota.");
    const mockReport = {
        role: "Software Engineer",
        company: "Mock Company",
        summary: {
            strengths: "Good problem-solving approach.",
            weaknesses: "Needs to elaborate more on results.",
            nextSteps: "Practice quantifying outcomes."
        },
        detailedFeedback: [
            {
                question: "This is a mock question about a project.",
                answer: "This is my detailed mock answer where I describe the project.",
                score: 4.5,
                details: "A well-structured answer.",
                tips: "Great job, try adding more numbers to the result."
            },
            {
                question: "This is a second mock question about teamwork.",
                answer: "This is another mock answer about how I collaborated with my team.",
                score: 3.8,
                details: "Good description of the action taken.",
                tips: "Clearly define the initial situation next time."
            }
        ]
    };
    return res.json(mockReport);
    */

    // --- REAL AI REPORT LOGIC (Currently Active) ---
    try {
        const session = await Session.findById(req.params.sessionId).populate('history.question');
        if (!session || session.status !== 'completed') {
            return res.status(404).json({ message: "Completed session not found." });
        }
        
        session.report = undefined; 

        const detailedFeedback = [];
        const categoryScores = { behavioral: [], theory: [], coding: [] };

        for (const item of session.history) {
            if (!item.userAnswer || !item.question) continue;

            console.log(`[DEBUG] Analyzing question: "${item.question.text}"`);

            let feedbackItem = null;
            const { category, text } = item.question;

            if (category === 'behavioral') {
                feedbackItem = await evaluateBehavioral(text, item.userAnswer);
            } else if (category === 'theory') {
                feedbackItem = await evaluateTheory(text, item.question.idealAnswer, item.userAnswer);
            } else if (category === 'coding') {
                const aiCritique = await evaluateCoding(text, item.userAnswer);
                if (aiCritique) {
                    feedbackItem = aiCritique;
                }
            }
            
            if (feedbackItem) {
                if (feedbackItem.score) categoryScores[category].push(feedbackItem.score);
                detailedFeedback.push({
                    question: text,
                    category: category,
                    answer: item.userAnswer,
                    ...feedbackItem
                });
            }
        }

        const summary = await generateFinalSummary(detailedFeedback);

        const finalScores = {
            behavioral: categoryScores.behavioral.length ? categoryScores.behavioral.reduce((a, b) => a + b, 0) / categoryScores.behavioral.length : 0,
            theory: categoryScores.theory.length ? categoryScores.theory.reduce((a, b) => a + b, 0) / categoryScores.theory.length : 0,
            coding: categoryScores.coding.length ? categoryScores.coding.reduce((a, b) => a + b, 0) / categoryScores.coding.length : 0,
        };

        const finalReport = {
            candidate: "Candidate",
            role: session.role,
            company: session.company,
            round: session.interviewType,
            finalScores: finalScores,
            summary: summary || { strengths: "N/A", weaknesses: "N/A", nextSteps: "N/A" },
            detailedFeedback: detailedFeedback
        };

        session.report = finalReport;
        await session.save();
        console.log("[DEBUG] Report generation complete. All questions analyzed.");
        res.json(finalReport);
    } catch (error) {
        console.error("Error in /analyze/session:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

module.exports = router;