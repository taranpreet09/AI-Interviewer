const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Session = require('../models/session');
const Question = require('../models/Question');
const { generateAiQuestion } = require('../utils/aiQuestionGen');
const { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini } = require('../utils/aiOrchestrator');
const router = express.Router();

function analyzeAnswer(question, answer) {
    if (!question || !question.category) { return { score: 2.5 }; }
    let score = 2.5;
    if (answer.length < 20) score -= 1.5; else if (answer.length > 100) score += 1;
    if (question.category === 'behavioral' && /(result|outcome|achieved)/i.test(answer)) score += 1.5;
    if (question.category === 'theory' && answer.length > 50) score = 4;
    if (question.category === 'coding' && answer.includes('return')) score = 5;
    return { score: Math.max(0, Math.min(5, score)) };
}
async function decideNextStep(session) {
    console.log('[DEBUG] Entering decideNextStep...');
    const history = session.history || [];

    let idx = history.length - 1;
    while (idx >= 0 && (!history[idx].question || history[idx].isFollowUp)) {
        idx--;
    }

    if (idx < 0) {
        idx = history.length - 1;
    }

    const lastItem = history[idx];
    if (!lastItem) {
        console.warn('[DEBUG] No history items available. Ending interview.');
        return { action: 'END_INTERVIEW' };
    }

    let questionObj = lastItem.question;
    if (questionObj && (typeof questionObj === 'string' || questionObj._id === undefined)) {
        try {
            questionObj = await Question.findById(questionObj);
            lastItem.question = questionObj;
        } catch (err) {
            console.warn('[DEBUG] Failed to load question document for decision-making:', err);
            return { action: 'END_INTERVIEW' };
        }
    }

    if (!questionObj || !questionObj.category) {
        console.warn('[DEBUG] Last question object missing category. Ending interview.');
        return { action: 'END_INTERVIEW' };
    }

    if (history.length >= 7) return { action: 'END_INTERVIEW' };

    const lastScore = (lastItem.analysis && typeof lastItem.analysis.score === 'number') ? lastItem.analysis.score : 2.5;
    let nextDifficulty = session.currentDifficulty || 'medium';
    if (lastScore >= 4.0) {
        nextDifficulty = (nextDifficulty === 'easy') ? 'medium' : 'hard';
    } else if (lastScore < 2.5) {
        nextDifficulty = (nextDifficulty === 'hard') ? 'medium' : 'easy';
    }

    if (lastScore < 2.5 && questionObj.category === 'behavioral' && !lastItem.isFollowUp) {
        console.log('[DEBUG] Decided to ASK_FOLLOW_UP.');
        return { action: 'ASK_FOLLOW_UP', followUp: "Can you elaborate on that?" };
    }

    const lastCategory = questionObj.category;
    const nextCategory = (lastCategory === 'behavioral') ? 'theory' : (lastCategory === 'theory' ? 'coding' : 'behavioral');

    const askedQuestionIds = history
        .map(h => (h.question && h.question._id) ? h.question._id.toString() : (h.question ? h.question.toString() : null))
        .filter(Boolean);

    const aiContext = {
        role: session.role, company: session.company, interviewType: session.interviewType,
        difficulty: nextDifficulty, type: nextCategory, history
    };

    let nextQuestion = null;
    let aiGeneratedData = null;
    try {
        aiGeneratedData = await generateAiQuestion(aiContext);
    } catch (err) {
        console.warn('[DEBUG] AI generation failed:', err);
    }

    if (aiGeneratedData) {
        try {
            let existingQuestion = await Question.findOne({ text: aiGeneratedData.text });
            if (existingQuestion) {
                console.log('[DEBUG] AI generated a duplicate question. Using existing document from DB.');
                nextQuestion = existingQuestion;
            } else {
                const newQ = new Question({ ...aiGeneratedData, source: 'ai', tags: [session.role, session.company].filter(Boolean) });
                await newQ.save();
                nextQuestion = newQ;
                console.log('[DEBUG] AI generated a new question and saved it to DB.');
            }
        } catch (err) {
            console.warn('[DEBUG] Error saving AI question:', err);
        }
    }

    if (!nextQuestion) {
        console.warn("[DEBUG] AI failed or couldn't save. Using DB fallback.");
        nextQuestion = await Question.findOne({ category: nextCategory, difficulty: nextDifficulty, _id: { $nin: askedQuestionIds } });
        if (!nextQuestion) {
            console.warn('[DEBUG] Primary fallback failed. Using ultimate fallback.');
            nextQuestion = await Question.findOne({ _id: { $nin: askedQuestionIds } });
        }
    }

    if (!nextQuestion) {
        console.error("[DEBUG] No next question could be found. Ending interview.");
        return { action: 'END_INTERVIEW' };
    }

    console.log(`[DEBUG] Decided to ASK_NEW_QUESTION. Text: "${String(nextQuestion.text).substring(0, 40)}..."`);
    return { action: 'ASK_NEW_QUESTION', question: nextQuestion, nextDifficulty };
}


router.post('/start', async (req, res) => {
    try {
        const { role, company, interviewType } = req.body;
        const newSession = new Session({
            role,
            company,
            interviewType,
            history: [] 
        });
        await newSession.save();
        res.json({ 
            sessionId: newSession._id,
            greeting: "Hello! I'm your AI interviewer. Thanks for joining. Let's begin with your first question." 
        });
    } catch (err) {
        console.error("Error starting session:", err);
        res.status(500).json({ message: "Error starting session" });
    }
});

router.post('/next-step', async (req, res) => {
    try {
        const { sessionId, answer } = req.body;
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        if (session.history.length > 0) {
            const lastItem = session.history[session.history.length - 1];
            lastItem.userAnswer = answer;
            lastItem.timestampEnd = new Date();
        }

        session.messages.push({ role: 'user', text: answer, type: 'answer' });
        const lastQuestion = await Question.findById(session.history[session.history.length - 1]?.question);
        const answerQuality = analyzeAnswerHeuristic(answer, lastQuestion);
        const prompt = buildInterviewerPrompt(session, answerQuality);

        const aiResponse = await callGemini(prompt);
        session.messages.push({ role: 'ai', text: aiResponse.dialogue, type: 'question' });

        if (aiResponse.action === 'CONTINUE') {
            const newQuestion = new Question({
                text: aiResponse.dialogue,
                category: aiResponse.category,
                difficulty: aiResponse.difficulty,
                source: 'ai',
                tags: [session.role].filter(Boolean)
            });
            await newQuestion.save();
            
            session.history.push({
                question: newQuestion._id,
                timestampStart: new Date()
            });
        } else if (aiResponse.action === 'END_INTERVIEW') {
            session.status = 'completed';
        }

        await session.save();
        res.json(aiResponse);
    } catch (err) {
        console.error("!!! CRITICAL ERROR IN /next-step !!!:", err);
        if (err.code === 11000) {
            const failsafeResponse = { action: "END_INTERVIEW", dialogue: "I seem to have repeated a question. Let's end the session here. Thank you for your time." };
            return res.json(failsafeResponse);
        }
        res.status(500).json({ message: "Error in orchestration", error: err.message });
    }
});

router.get('/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId).populate('history.question');
        if (!session) return res.status(404).json({ message: "Session not found" });
        res.json(session);
    } catch (err) { res.status(500).json({ message: "Error fetching session", error: err.message }); }
});

router.post('/code/submit', async (req, res) => {
    const { source_code, language_id } = req.body;
    const options = {
        method: 'POST',
        url: `https://${process.env.JUDGE0_API_HOST}/submissions`,
        params: { base64_encoded: 'false', wait: 'true' },
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Host': process.env.JUDGE0_API_HOST,
            'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        },
        data: { language_id, source_code }
    };
    try {
        const response = await axios.request(options);
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ message: 'Error executing code' });
    }
});

module.exports = router;