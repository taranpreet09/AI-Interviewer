// /routes/report.js
// NEW FILE - Generates the final structured report for the dashboard.

const express = require('express');
const router = express.Router();
const Session = require('../models/session');

// --- Analysis Helper Functions ---

function analyzeSession(session) {
    const report = {
        candidate: "Candidate", // Placeholder name
        role: session.role,
        round: session.interviewType,
        scores: { behavioral: 0, theory: 0, coding: 0 },
        feedback: { behavioral: "", theory: "", coding: "" },
        summary: ""
    };

    const behavioralAnswers = session.messages.filter(m => m.analysis && m.analysis.isWeak !== undefined && !m.type.includes('coding'));
    const codingAnswers = session.messages.filter(m => m.type.includes('coding')); // A simple heuristic

    // Behavioral Analysis
    if (behavioralAnswers.length > 0) {
        const avgScore = behavioralAnswers.reduce((sum, msg) => sum + (msg.analysis.score || 2.5), 0) / behavioralAnswers.length;
        report.scores.behavioral = parseFloat(avgScore.toFixed(1));
        if (avgScore > 4) {
            report.feedback.behavioral = "Excellent. Answers were well-structured, confident, and detailed.";
        } else if (avgScore > 2.5) {
            report.feedback.behavioral = "Good confidence and clear communication, but answers could be more structured. Remember to detail specific outcomes.";
        } else {
            report.feedback.behavioral = "Candidate should practice articulating their experiences using the STAR method to provide more depth.";
        }
    }

    // Theory/Coding Analysis (Simplified for this example)
    report.scores.theory = 4.0;
    report.feedback.theory = "Solid understanding of core concepts. Missed some nuance on polymorphism.";
    report.scores.coding = 5.0;
    report.feedback.coding = "Correct and clean solution, but the O(n²) time complexity could be optimized.";

    // Overall Summary
    const overallScore = (report.scores.behavioral + report.scores.theory + report.scores.coding) / 3;
    if (overallScore > 4.0) {
        report.summary = "Strong candidate with excellent problem-solving skills and clear communication. A great fit for the role.";
    } else {
        report.summary = "Promising candidate with strong technical skills. Would benefit from more practice in structured behavioral storytelling to better showcase their impact.";
    }

    return report;
}


// --- API Route ---
router.get('/analyze/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId);
        if (!session || session.status !== 'completed') {
            return res.status(404).json({ message: "Completed session not found." });
        }
        
        // Generate the structured report
        const reportData = analyzeSession(session);

        res.json(reportData);

    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

module.exports = router;