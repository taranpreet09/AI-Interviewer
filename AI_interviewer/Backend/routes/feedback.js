const express = require('express');
const router = express.Router();
const Session = require('../models/session');

// NOTE: This file has been largely superseded by the AI-powered evaluation system
// in aiEvaluator.js. The functions below are kept for backward compatibility
// but the main report generation now happens in report.js using AI evaluation.

router.post('/analyze/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId).populate('history.question');
        
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Check if session has been processed already
        if (session.report && session.report.summary) {
            return res.status(200).json({
                message: "Session already analyzed",
                report: session.report,
                sessionId: session._id
            });
        }

        // For backward compatibility, create a basic report structure
        const report = {
            behavioralAnalysis: [],
            theoryAnalysis: [],
            codingAnalysis: [],
            summary: 'Analysis completed. View detailed report for comprehensive feedback.',
            finalScores: {
                behavioral: { score: "0.0", feedback: "Use /report/analyze/session endpoint for detailed analysis" },
                theory: { score: "0.0", feedback: "Use /report/analyze/session endpoint for detailed analysis" },
                coding: { score: "0.0", feedback: "Use /report/analyze/session endpoint for detailed analysis" }
            }
        };

        // Quick analysis for immediate feedback
        let totalQuestions = 0;
        let answeredQuestions = 0;

        for (const historyItem of session.history) {
            if (historyItem.question) {
                totalQuestions++;
                if (historyItem.userAnswer && historyItem.userAnswer.trim().length > 0) {
                    answeredQuestions++;
                }
            }
        }

        report.summary = `Interview completed with ${answeredQuestions}/${totalQuestions} questions answered. For detailed AI-powered analysis, please use the main report endpoint.`;
        
        // Save basic report
        session.report = report;
        await session.save();

        res.status(200).json({
            message: "Basic analysis completed",
            session: session,
            note: "For comprehensive AI evaluation, use /report/analyze/session/:sessionId endpoint"
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ 
            message: "Error in basic analysis", 
            error: error.message,
            recommendation: "Use /report/analyze/session/:sessionId for full analysis"
        });
    }
});

module.exports = router;