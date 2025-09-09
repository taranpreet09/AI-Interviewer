const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Session = require('../models/session');
const Question = require('../models/Question');
const { generateAiQuestion } = require('../utils/aiQuestionGen');
const { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini } = require('../utils/aiOrchestrator');
const { evaluateBehavioral, evaluateTheory, evaluateCoding } = require('../utils/aiEvaluator');
const router = express.Router();

router.post('/start', async (req, res) => {
    try {
        const { role, company, interviewType, interviewMode } = req.body;
        
        // Add input validation
        if (!interviewMode || !interviewType) {
            return res.status(400).json({ message: "interviewMode and interviewType are required." });
        }
        if (!role || role.trim() === '') {
            return res.status(400).json({ message: "Role is a required field." });
        }
        
        // Validate interviewMode values
        if (!['full', 'specific'].includes(interviewMode)) {
            return res.status(400).json({ message: "interviewMode must be 'full' or 'specific'." });
        }
        
        const newSession = new Session({ 
            role: role, // --- REMOVED THE FALLBACK ---
            company: company || 'Tech Company', // This fallback is fine as company is less critical
            interviewType, 
            interviewMode, 
            history: [],
            messages: []
        });
        
        await newSession.save();
        
        res.json({
            sessionId: newSession._id,
            greeting: `Hello! I'm Alex, your AI interviewer. Thanks for joining us today for this ${interviewType} interview. Let's begin!`
        });
    } catch (err) {
        console.error("Error starting session:", err);
        res.status(500).json({ message: "Error starting session", error: err.message });
    }
});

// routes/interview.js

router.post('/next-step', async (req, res) => {
    try {
        const { sessionId, answer } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ message: "sessionId is required" });
        }
        
        const session = await Session.findById(sessionId).populate('history.question');

        if (!session || session.status === 'completed') {
            return res.status(404).json({ message: "Session not found or already completed." });
        }

        // Initialize promptContext early to prevent reference errors.
        let promptContext = {
            role: session.role,
            interviewType: session.interviewType,
            interviewMode: session.interviewMode,
            currentStage: session.currentStage,
            transitionText: null, // This will be updated by adaptive/stage logic
            lastAnswerAnalysis: null // This will be updated after scoring
        };

        // Process the user's answer if there's a pending question
        if (session.history.length > 0 && answer !== undefined) {
            const lastItem = session.history[session.history.length - 1];
            if (lastItem && !lastItem.userAnswer) {
                lastItem.userAnswer = answer || "";
                lastItem.timestampEnd = new Date();
                
                const answerAnalysis = analyzeAnswerHeuristic(answer, lastItem.question);
                
                // Get AI evaluation score
                let score = 2.5; // Default score
                try {
                    if (lastItem.question.category === 'behavioral') {
                        const evalResult = await evaluateBehavioral(lastItem.question.text, answer);
                        score = evalResult?.score || 2.5;
                    } else if (lastItem.question.category === 'theory') {
                        const evalResult = await evaluateTheory(lastItem.question.text, lastItem.question.idealAnswer, answer);
                        score = evalResult?.score || 2.5;
                    } else if (lastItem.question.category === 'coding') {
                        const evalResult = await evaluateCoding(lastItem.question.text, answer);
                        score = evalResult?.score || 2.5;
                    }
                } catch (evalError) {
                    console.error("Evaluation error:", evalError);
                }
                
                lastItem.analysis = { 
                    score, 
                    isWeak: answerAnalysis.isWeak,
                    isRude: answerAnalysis.isRude 
                };

                // Update promptContext with the latest analysis
                promptContext.lastAnswerAnalysis = lastItem.analysis;
                
                // Adaptive Difficulty Logic
                if (session.interviewMode === 'full') {
                    const scoredHistory = session.history.filter(h => h.analysis && typeof h.analysis.score === 'number');
                    if (scoredHistory.length > 0) {
                        const totalScore = scoredHistory.reduce((sum, h) => sum + h.analysis.score, 0);
                        const averageScore = totalScore / scoredHistory.length;

                        if (averageScore >= 4.0 && session.currentDifficulty !== 'hard') {
                            session.currentDifficulty = 'hard';
                            promptContext.transitionText = "That's a very strong answer. Let's try something more challenging.";
                        } else if (averageScore < 2.5 && session.currentDifficulty !== 'easy') {
                            session.currentDifficulty = 'easy';
                            promptContext.transitionText = "Okay, let's switch gears a bit. I have another question for you.";
                        } else if (averageScore >= 2.5 && averageScore < 4.0 && session.currentDifficulty !== 'medium') {
                            session.currentDifficulty = 'medium';
                        }
                    }
                }
            }
        }

        // Handle stage transitions for full interviews
        if (session.interviewMode === 'full') {
            const questionsInCurrentStage = session.history.filter(h => h.stage === session.currentStage).length;
            
            if (session.currentStage === 1 && questionsInCurrentStage >= 3) {
                session.currentStage = 2;
                promptContext.currentStage = 2;
                promptContext.transitionText = promptContext.transitionText || "Great! That gives me a good overview. Let's dive deeper into some technical areas now.";
            } else if (session.currentStage === 2 && questionsInCurrentStage >= 4) {
                session.currentStage = 3;
                promptContext.currentStage = 3;
                promptContext.transitionText = promptContext.transitionText || "Excellent technical discussion! For our final segment, I'd like to understand more about your leadership and collaboration experience.";
            } else if (session.currentStage === 3 && questionsInCurrentStage >= 2) {
                session.status = 'completed';
            }
        }

        // Add user message to conversation history
        if (answer !== undefined) {
            session.messages.push({ role: 'user', content: answer });
        }
        
        // Build conversation context
        promptContext.recentHistory = session.messages
            .slice(-10) 
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');
        
        const prompt = buildInterviewerPrompt(session, promptContext);
        const aiResponse = await callGemini(prompt, session);

        if (aiResponse.action === 'CONTINUE' && session.status !== 'completed') {
            const questionDoc = await Question.findOneAndUpdate(
                { text: aiResponse.dialogue },
                { 
                    $setOnInsert: { 
                        text: aiResponse.dialogue, 
                        category: aiResponse.category, 
                        difficulty: session.currentDifficulty || aiResponse.difficulty || 'medium', 
                        source: 'ai' 
                    }
                },
                { upsert: true, new: true }
            );
            
            session.history.push({ 
                question: questionDoc._id, 
                timestampStart: new Date(),
                stage: session.currentStage
            });
            
            session.messages.push({ role: 'assistant', content: aiResponse.dialogue });
        } else {
            session.status = 'completed';
            session.endReason = 'natural_conclusion';
        }

        await session.save();
        
        const responsePayload = { 
            ...aiResponse, 
            currentStage: session.currentStage,
            sessionStatus: session.status
        };
        
        res.json(responsePayload);

    } catch (err) {
        console.error("Critical error in /next-step:", err);
        res.status(500).json({ 
            message: "Error in interview orchestration", 
            error: err.message,
            action: "END_INTERVIEW",
            dialogue: "I apologize, but we're experiencing technical difficulties. Let's conclude our interview here."
        });
    }
});

router.post('/end/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { finalAnswer } = req.body;
        
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Handle final answer if provided
        if (typeof finalAnswer === 'string' && session.history.length > 0) {
            const lastItem = session.history[session.history.length - 1];
            if (lastItem && !lastItem.userAnswer) {
                lastItem.userAnswer = finalAnswer;
                lastItem.timestampEnd = new Date();
                
                // Quick analysis for final answer
                lastItem.analysis = { score: 2.5, isWeak: finalAnswer.length < 20 };
            }
        }

        session.status = 'completed';
        session.endReason = session.endReason || 'user_ended';
        session.lastActivity = new Date();
        
        await session.save();

        res.status(200).json({ 
            message: "Interview ended successfully. Generating your report...",
            sessionId: session._id
        });
        
    } catch (error) {
        console.error("Error ending session:", error);
        res.status(500).json({ message: "Failed to end session", error: error.message });
    }
});

router.get('/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId).populate('history.question');
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        res.json(session);
    } catch (err) {
        console.error("Error fetching session:", err);
        res.status(500).json({ message: "Error fetching session", error: err.message });
    }
});

router.post('/code/submit', async (req, res) => {
    const { source_code, language_id } = req.body;
    
    if (!source_code) {
        return res.status(400).json({ message: 'Source code is required' });
    }
    
    const options = {
        method: 'POST',
        url: `https://${process.env.JUDGE0_API_HOST}/submissions`,
        params: { base64_encoded: 'false', wait: 'true' },
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Host': process.env.JUDGE0_API_HOST,
            'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        },
        data: { language_id: language_id || 93, source_code },
        timeout: 10000 // 10 second timeout
    };
    
    try {
        const response = await axios.request(options);
        res.json(response.data);
    } catch (err) {
        console.error("Code execution error:", err);
        res.status(500).json({ 
            message: 'Error executing code',
            error: err.response?.data || err.message 
        });
    }
});

module.exports = router;