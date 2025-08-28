const express = require('express');
const Session = require('../models/session');
const questionBank = require('../utils/questionBank');
const { generateAiQuestion } = require('../utils/aiQuestionGen');
const { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini } = require('../utils/aiOrchestrator');
const router = express.Router();

function analyzeAnswer(question, answer) {
    if (!question || !question.type) { return { score: 2.5 }; }
    let score = 2.5;
    if (answer.length < 20) score -= 1.5; else if (answer.length > 100) score += 1;
    if (question.type === 'behavioral' && /(result|outcome|achieved)/i.test(answer)) score += 1.5;
    if (question.type === 'theory' && answer.length > 50) score = 4;
    if (question.type === 'coding' && answer.includes('return')) score = 5;
    return { score: Math.max(0, Math.min(5, score)) };
}

// async function decideNextStep(session) {
//     const history = session.history;
//     const lastItem = history[history.length - 1];
//     if (!lastItem || !lastItem.question) { throw new Error("Last history item is invalid."); }
//     if (history.length >= 7) return { action: 'END_INTERVIEW' };

//     const lastScore = lastItem.analysis?.score || 2.5;
//     let nextDifficulty = session.currentDifficulty || 'medium';
//     if (lastScore >= 4.0) { nextDifficulty = (nextDifficulty === 'easy') ? 'medium' : 'hard'; } 
//     else if (lastScore < 2.5) { nextDifficulty = (nextDifficulty === 'hard') ? 'medium' : 'easy'; }
    
//     if (lastScore < 2.5 && lastItem.question.type === 'behavioral' && !lastItem.isFollowUp) {
//         return { action: 'ASK_FOLLOW_UP', followUp: "Can you elaborate?" };
//     }
    
//     const lastType = lastItem.question.type;
//     const nextType = (lastType === 'behavioral') ? 'theory' : (lastType === 'theory' ? 'coding' : 'behavioral');
//     const aiContext = { role: session.role, company: session.company, interviewType: session.interviewType, difficulty: nextDifficulty, type: nextType, history };

//     let nextQuestion;
//     const aiGeneratedData = await generateAiQuestion(aiContext);

//     if (aiGeneratedData) {
//         nextQuestion = { ...aiGeneratedData, questionSource: 'AI' };
//     } else {
//         console.warn("AI Generation failed. Using fallback from questionBank.js.");
//         const askedQuestions = history.map(h => h.question.text);
//         const availableQuestions = questionBank[nextType][nextDifficulty].filter(q => !askedQuestions.includes(q.text));
//         const bankQuestion = availableQuestions.length > 0 ? availableQuestions[0] : questionBank[nextType]['medium'][0];
//         nextQuestion = { ...bankQuestion, type: nextType, difficulty: nextDifficulty, questionSource: 'Bank' };
//     }
//     return { action: 'ASK_NEW_QUESTION', question: nextQuestion, nextDifficulty };
// }

router.post('/start', async (req, res) => {
    try {
        const { role, company, interviewType } = req.body;
        
        // Start with a friendly greeting
        const greetingText = `Hi, thanks for coming in today! I'm Gemini, and I'll be conducting your initial ${interviewType} screen for the ${role} position. Ready to get started?`;
        
        const firstMessage = { role: 'ai', text: greetingText, type: 'greeting' };

        const newSession = new Session({
            role, company, interviewType,
            messages: [firstMessage]
        });
        await newSession.save();
        res.status(201).json({ sessionId: newSession._id, firstMessage });
    } catch (error) {
        res.status(500).json({ message: 'Server error on start', error: error.message });
    }
});

router.post('/next-step', async (req, res) => {
    try {
        const { sessionId, answer } = req.body;
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        const lastAiQuestion = session.messages.filter(m => m.role === 'ai').pop();
        const answerQuality = analyzeAnswerHeuristic(answer, lastAiQuestion);
        
        session.messages.push({
            role: 'user', text: answer, type: 'answer',
            analysis: { isWeak: answerQuality.isWeak }
        });

        const prompt = buildInterviewerPrompt(session, answerQuality);
        const { dialogue, endSignal } = await callGemini(prompt);
        
        // Check if the AI has decided to end the interview
        if (endSignal && endSignal.interview_end === true) {
            session.messages.push({ role: 'ai', text: dialogue, type: 'closing' });
            session.status = 'completed';
            await session.save();
            // Send the final message along with the end action
            return res.json({ action: 'END_INTERVIEW', finalMessage: dialogue });
        }

        // If not ending, proceed as a normal turn
        const responseType = answerQuality.isWeak ? 'followup' : 'question';
        const aiMessage = { role: 'ai', text: dialogue, type: responseType };
        session.messages.push(aiMessage);
        await session.save();
        
        res.json(aiMessage); // Send the new AI message back to the frontend
    } catch (err) {
        console.error("!!! CRITICAL ERROR IN /next-step !!!:", err);
        res.status(500).json({ message: "Error in orchestration", error: err.message });
    }
});

router.get('/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });
        res.json(session);
    } catch (err) {
        res.status(500).json({ message: "Error fetching session", error: err.message });
    }
});

module.exports = router;