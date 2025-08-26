// /routes/feedback.js
// NEW FILE - Contains all the AI analysis logic

const express = require('express');
const router = express.Router();
const Session = require('../models/session');

// --- Mock Analysis Functions ---

// Mock sentiment/confidence analysis
const analyzeSentiment = (text) => {
    // In a real app, use HuggingFace Transformers.js or an API
    const positiveWords = ['confident', 'achieved', 'successfully', 'improved', 'led'];
    const neutralWords = ['task', 'situation', 'role', 'handled'];
    let score = 2.5; // Start neutral
    if (positiveWords.some(word => text.toLowerCase().includes(word))) score += 1.5;
    if (text.length > 200) score += 1;
    return Math.min(score, 5); // Cap at 5
};

// Mock STAR method analysis using regex/keywords
const analyzeSTAR = (text) => {
    const s = /(situation|context|my role was|project i worked on)/i.test(text) ? 1 : 0;
    const t = /(task|objective|goal|i needed to)/i.test(text) ? 1 : 0;
    const a = /(action|i did|i implemented|we built)/i.test(text) ? 1 : 0;
    const r = /(result|outcome|achieved|the impact was|we delivered)/i.test(text) ? 1 : 0;
    let score = s + t + a + r;
    if (text.length > 200) score++; // Bonus point for detail
    return score; // Max score of 5
};

const analyzeSentimentAndConfidence = (text) => {
    // Mocking confidence. In a real app, use a proper sentiment analysis model.
    const confidentWords = ['led', 'achieved', 'successfully', 'delivered', 'resolved'];
    let confidence = 2.5; // Neutral start
    if (confidentWords.some(word => text.toLowerCase().includes(word))) confidence += 2;
    if (text.length < 50) confidence -=1;
    return Math.max(0, Math.min(5, confidence)); // Clamp score between 0 and 5
};

const analyzeBehavioral = (question) => {
    const answer = question.userAnswer;
    const confidence = analyzeSentimentAndConfidence(answer);
    const starCompleteness = analyzeSTAR(answer);
    const clarity = answer.length > 80 ? 4 : 2; // Simple clarity check

    let feedback = "Good response. ";
    if (starCompleteness < 3) feedback += "Try to structure your answer more clearly using the STAR method (Situation, Task, Action, Result). ";
    if (confidence < 3) feedback += "Speak with more confidence about your achievements. ";

    return {
        questionText: question.text,
        scores: {
            clarity: clarity.toFixed(1),
            confidence: confidence.toFixed(1),
            starCompleteness: starCompleteness,
        },
        feedback
    };
};


const analyzeTheory = (question) => {
    // Simple keyword-based check
    const answer = question.userAnswer.toLowerCase();
    let score = 0;
    if (question.text.includes("Big O")) {
        if (answer.includes("worst-case") || answer.includes("time complexity")) score = 4;
        else if (answer.includes("performance")) score = 2;
    } else {
        score = answer.length > 50 ? 4 : 2;
    }
    return {
        questionText: question.text,
        score: score,
        feedback: "The explanation was clear. Adding a concrete example would make it even stronger."
    };
};

const analyzeCoding = (question) => {
    const code = question.userAnswer;
    const result = question.codeResult;
    let feedback = "The code addresses the problem statement. ";
    let readability = "Good";
    let timeComplexity = "O(n)"; // Mock default
    let spaceComplexity = "O(1)"; // Mock default

    if (code.includes("for") && code.match(/for/g).length > 1) { // Nested loop check
        timeComplexity = "O(n^2)";
        feedback += "The nested loop impacts performance. Consider a single-pass solution. ";
    }
    if (code.length > 300) {
        readability = "Could be improved with more functions.";
    }

    return {
        questionText: question.text,
        correctness: result?.status || "Not executed",
        timeComplexity,
        spaceComplexity,
        readability,
        feedback
    };
};

// --- Main Analysis Route ---

router.post('/analyze/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        const report = {
            behavioralAnalysis: [],
            theoryAnalysis: [],
            codingAnalysis: [],
            summary: '',
            finalScores: {}
        };

        let behavioralScores = [];
        let theoryScores = [];
        let codingScores = [];

        for (const q of session.questions) {
            if (q.type === 'behavioral') {
                const analysis = analyzeBehavioral(q);
                report.behavioralAnalysis.push(analysis);
                behavioralScores.push((parseFloat(analysis.scores.clarity) + parseFloat(analysis.scores.confidence) + analysis.scores.starCompleteness) / 3);
            }
            // Add similar loops for theory and coding...
        }
        
        // Calculate final scores and feedback summaries
        if (behavioralScores.length > 0) {
            const avg = behavioralScores.reduce((a, b) => a + b, 0) / behavioralScores.length;
            let feedback = avg > 3.5 ? "Good confidence and structure." : "Work on structured storytelling.";
            report.finalScores.behavioral = { score: avg.toFixed(1), feedback };
        }
        // ... Calculate for theory and coding ...
        report.finalScores.theory = { score: 4.0, feedback: "Missed polymorphism details."};
        report.finalScores.coding = { score: 5.0, feedback: "Correct & readable, O(n²) complexity." };


        report.summary = "A strong performance overall. The candidate is a capable coder and communicates effectively. Key areas for improvement include detailing the results of their actions in behavioral questions.";
        
        session.report = report;
        await session.save();

        res.status(200).json(session);
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

module.exports = router;