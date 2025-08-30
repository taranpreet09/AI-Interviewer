
const express = require('express');
const router = express.Router();
const Session = require('../models/session');

const analyzeSTAR = (text) => {
    const s = /(situation|context|my role was|project i worked on)/i.test(text) ? 1 : 0;
    const t = /(task|objective|goal|i needed to)/i.test(text) ? 1 : 0;
    const a = /(action|i did|i implemented|we built)/i.test(text) ? 1 : 0;
    const r = /(result|outcome|achieved|the impact was|we delivered)/i.test(text) ? 1 : 0;
    let score = s + t + a + r;
    if (text.length > 200) score++;
    return score;
};

const analyzeSentimentAndConfidence = (text) => {
    const confidentWords = ['led', 'achieved', 'successfully', 'delivered', 'resolved'];
    let confidence = 2.5;
    if (confidentWords.some(word => text.toLowerCase().includes(word))) confidence += 2;
    if (text.length < 50) confidence -=1;
    return Math.max(0, Math.min(5, confidence));
};

const analyzeBehavioral = (historyItem) => {
    const answer = historyItem.userAnswer;
    const confidence = analyzeSentimentAndConfidence(answer);
    const starCompleteness = analyzeSTAR(answer);
    const clarity = answer.length > 80 ? 4.5 : 2.5;

    let feedback = "A solid attempt. ";
    if (starCompleteness < 3) feedback += "For greater impact, structure your answer using the STAR method (Situation, Task, Action, Result). ";
    if (confidence < 3.5) feedback += "Try to convey more confidence when describing your accomplishments. ";

    return {
        questionText: historyItem.question.text,
        scores: {
            clarity: clarity.toFixed(1),
            confidence: confidence.toFixed(1),
            starCompleteness: starCompleteness,
        },
        feedback
    };
};

const analyzeTheory = (historyItem) => {
    return {
        questionText: historyItem.question.text,
        score: historyItem.analysis.score, 
        feedback: "The explanation was clear. Adding a concrete example would make it even stronger."
    };
};

const analyzeCoding = (historyItem) => {
     return {
        questionText: historyItem.question.text,
        correctness: historyItem.analysis.score > 3 ? "Accepted" : "Partial",
        timeComplexity: "O(n)",
        spaceComplexity: "O(1)",
        readability: "Good",
        feedback: "The code addresses the main problem statement."
    };
};

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

        for (const historyItem of session.history) {
            if (!historyItem.userAnswer) continue;

            if (historyItem.question.category === 'behavioral') {
                const analysis = analyzeBehavioral(historyItem);
                report.behavioralAnalysis.push(analysis);
                behavioralScores.push((parseFloat(analysis.scores.clarity) + parseFloat(analysis.scores.confidence) + analysis.scores.starCompleteness) / 3);
            } else if (historyItem.question.category === 'theory') {
                const analysis = analyzeTheory(historyItem);
                report.theoryAnalysis.push(analysis);
                theoryScores.push(analysis.score);
            } else if (historyItem.question.category === 'coding') {
                const analysis = analyzeCoding(historyItem);
                report.codingAnalysis.push(analysis);
                codingScores.push(historyItem.analysis.score); 
            }
        }
        
        if (behavioralScores.length > 0) {
            const avg = behavioralScores.reduce((a, b) => a + b, 0) / behavioralScores.length;
            report.finalScores.behavioral = { score: avg.toFixed(1), feedback: avg > 3.5 ? "Good confidence and structure." : "Work on structured storytelling." };
        }
        if (theoryScores.length > 0) {
            const avg = theoryScores.reduce((a, b) => a + b, 0) / theoryScores.length;
            report.finalScores.theory = { score: avg.toFixed(1), feedback: avg > 3.5 ? "Strong technical knowledge." : "Review core concepts." };
        }
        if (codingScores.length > 0) {
            const avg = codingScores.reduce((a, b) => a + b, 0) / codingScores.length;
            report.finalScores.coding = { score: avg.toFixed(1), feedback: avg > 3.5 ? "Excellent problem-solving." : "Practice algorithmic thinking." };
        }
        
        report.summary = "A solid performance. The candidate shows promise in problem-solving and can be coached on communication style for greater impact.";
        
        session.report = report;
        await session.save();

        res.status(200).json(session);
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ message: "Error generating report", error: error.message });
    }
});

module.exports = router;