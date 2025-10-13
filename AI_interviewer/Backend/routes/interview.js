const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Session = require('../models/session');
const Question = require('../models/Question');
const { generateAiQuestion } = require('../utils/aiQuestionGen');
const { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini } = require('../utils/aiOrchestrator');
const { evaluateBehavioral, evaluateTheory, evaluateCoding } = require('../utils/aiEvaluator');
const { finalizeSessionAndStartReport } = require('../services/sessionManager');

const router = express.Router();

// Enhanced greeting generation based on candidate context
function generatePersonalizedGreeting(session) {
    const { role, company, interviewType, candidateContext } = session;
    
    let greeting = `Hello! I'm Alex, your AI interviewer. `;
    
    // Add context-aware personalization
    if (candidateContext) {
        if (candidateContext.toLowerCase().includes('student') || candidateContext.toLowerCase().includes('graduate')) {
            greeting += `It's great to meet someone just starting their career journey! `;
        } else if (candidateContext.toLowerCase().includes('senior') || candidateContext.toLowerCase().includes('lead')) {
            greeting += `I'm excited to learn about your leadership experience! `;
        } else if (candidateContext.toLowerCase().includes('career change') || candidateContext.toLowerCase().includes('transition')) {
            greeting += `I admire people who take on new challenges - career transitions show real courage! `;
        }
    }
    
    greeting += `I'm looking forward to our ${interviewType.toLowerCase()} conversation for the ${role} position`;
    
    if (company && company !== 'Tech Company') {
        greeting += ` at ${company}`;
    }
    
    greeting += `. `;
    
    // Add interview-specific context
    if (interviewType === 'Behavioral') {
        greeting += `I'm really interested in hearing about your experiences and the stories behind your achievements. `;
    } else if (interviewType === 'Coding Challenge') {
        greeting += `We'll work through some coding problems together - think of it as a collaborative session rather than a test. `;
    } else if (interviewType === 'Technical Screen') {
        greeting += `We'll explore your technical knowledge and approach to problem-solving. `;
    } else if (interviewType === 'System Design') {
        greeting += `I'm curious about how you approach designing scalable systems. `;
    }
    
    greeting += `Should we start with you telling me a bit about yourself and what brought you to apply for this role?`;
    
    return greeting;
}

router.post('/start', async (req, res) => {
    try {
        const { role, company, interviewType, interviewMode, candidateContext } = req.body;
        
        // Enhanced validation with better error messages
        if (!interviewMode || !interviewType) {
            return res.status(400).json({ 
                message: "Please specify both interview mode and type to personalize your experience." 
            });
        }
        
        if (!role || role.trim() === '') {
            return res.status(400).json({ 
                message: "Please specify the role you're interviewing for so I can tailor our conversation." 
            });
        }
        
        if (!['full', 'specific'].includes(interviewMode)) {
            return res.status(400).json({ 
                message: "Interview mode must be either 'full' (complete interview) or 'specific' (focused session)." 
            });
        }
        
        const newSession = new Session({ 
            role: role.trim(),
            company: company?.trim() || 'Tech Company',
            interviewType, 
            interviewMode,
            candidateContext: candidateContext?.trim() || null,
            history: [],
            messages: [],
            // Initialize conversation memory
            conversationMemory: {
                mentionedExperiences: [],
                technicalTopics: [],
                personalTraits: [],
                backgroundHighlights: []
            }
        });
        
        await newSession.save();
        
        // Generate personalized greeting
        const personalizedGreeting = generatePersonalizedGreeting(newSession);
        
        // Store the greeting as the first message
        newSession.messages.push({ 
            role: 'assistant', 
            content: personalizedGreeting 
        });
        await newSession.save();
        
        res.json({
            sessionId: newSession._id,
            greeting: personalizedGreeting,
            sessionContext: {
                role: newSession.role,
                company: newSession.company,
                interviewType: newSession.interviewType,
                hasBackground: !!candidateContext
            }
        });
        
    } catch (err) {
        console.error("Error starting session:", err);
        res.status(500).json({ 
            message: "Sorry, I'm having trouble setting up your interview session. Please try again.", 
            error: err.message 
        });
    }
});

// Enhanced context extraction from candidate responses
function extractContextClues(answer, session) {
    const clues = {
        experiences: [],
        skills: [],
        companies: [],
        projects: [],
        challenges: [],
        emotions: []
    };
    
    // Extract mentioned companies
    const companyPatterns = /\b(at|with|in|for)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|LLC|Ltd|Company)?)\b/g;
    let match;
    while ((match = companyPatterns.exec(answer)) !== null) {
        clues.companies.push(match[2].trim());
    }
    
    // Extract project mentions
    const projectPatterns = /\b(project|application|system|platform|tool|website|app)\s+(called|named|for)\s+([A-Za-z\s]+)/gi;
    while ((match = projectPatterns.exec(answer)) !== null) {
        clues.projects.push(match[3].trim());
    }
    
    // Extract technical skills
    const techPatterns = /\b(React|Vue|Angular|Node|Python|Java|JavaScript|TypeScript|AWS|Azure|Docker|Kubernetes|MySQL|MongoDB|PostgreSQL|Redis|GraphQL|REST|API|Git|GitHub|Jenkins|CI\/CD)\b/gi;
    const techSkills = answer.match(techPatterns) || [];
    clues.skills = [...new Set(techSkills.map(skill => skill.toLowerCase()))];
    
    // Extract emotional context
    const emotionPatterns = {
        proud: /\b(proud|excited|thrilled|accomplished|achieved|successful)\b/i,
        challenged: /\b(challenging|difficult|hard|struggled|complex|tough)\b/i,
        learned: /\b(learned|discovered|realized|understood|gained|improved)\b/i,
        collaborative: /\b(team|together|collaborated|worked with|pair|group)\b/i
    };
    
    Object.entries(emotionPatterns).forEach(([emotion, pattern]) => {
        if (pattern.test(answer)) {
            clues.emotions.push(emotion);
        }
    });
    
    return clues;
}

// Update session memory with extracted context
function updateSessionMemory(session, contextClues, currentAnswer) {
    if (!session.conversationMemory) {
        session.conversationMemory = {
            mentionedExperiences: [],
            technicalTopics: [],
            personalTraits: [],
            backgroundHighlights: []
        };
    }
    
    // Add new experiences
    if (contextClues.companies.length > 0) {
        session.conversationMemory.mentionedExperiences.push({
            type: 'company',
            value: contextClues.companies,
            context: currentAnswer.substring(0, 100)
        });
    }
    
    if (contextClues.projects.length > 0) {
        session.conversationMemory.mentionedExperiences.push({
            type: 'project',
            value: contextClues.projects,
            context: currentAnswer.substring(0, 100)
        });
    }
    
    // Add technical topics
    session.conversationMemory.technicalTopics.push(...contextClues.skills);
    session.conversationMemory.technicalTopics = [...new Set(session.conversationMemory.technicalTopics)];
    
    // Add personality traits based on emotional context
    contextClues.emotions.forEach(emotion => {
        if (!session.conversationMemory.personalTraits.includes(emotion)) {
            session.conversationMemory.personalTraits.push(emotion);
        }
    });
    
    // Keep memory manageable (last 10 experiences)
    if (session.conversationMemory.mentionedExperiences.length > 10) {
        session.conversationMemory.mentionedExperiences = session.conversationMemory.mentionedExperiences.slice(-10);
    }
}
router.post('/next-step', async (req, res) => {
    try {
        const { sessionId, answer } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ message: "Session ID is required to continue our conversation." });
        }
        
        const session = await Session.findById(sessionId).populate('history.question');

        if (!session || session.status === 'completed') {
            return res.status(404).json({ 
                message: session ? "Our interview has already concluded." : "I couldn't find your interview session."
            });
        }

        // Initialize enhanced prompt context
        let promptContext = {
            role: session.role,
            interviewType: session.interviewType,
            interviewMode: session.interviewMode,
            currentStage: session.currentStage,
            transitionText: null,
            lastAnswerAnalysis: null,
            candidateProfile: {
                background: session.candidateContext,
                conversationMemory: session.conversationMemory || {},
                recentContext: null
            }
        };

        // Process user's answer with enhanced context extraction
        if (session.history.length > 0 && answer !== undefined && answer.trim() !== '') {
            const lastItem = session.history[session.history.length - 1];
            if (lastItem && !lastItem.userAnswer) {
                lastItem.userAnswer = answer;
                lastItem.timestampEnd = new Date();
                
                // Extract context clues from the answer
                const contextClues = extractContextClues(answer, session);
                updateSessionMemory(session, contextClues, answer);
                
                // Enhanced answer analysis with sentiment
                const answerAnalysis = analyzeAnswerHeuristic(answer, lastItem.question);
                
                // Get AI evaluation score
                let score = 2.5;
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
                    isRude: answerAnalysis.isRude,
                    emotions: answerAnalysis.emotions,
                    sentiment: answerAnalysis.sentiment
                };

                // Update prompt context with analysis and extracted context
                promptContext.lastAnswerAnalysis = lastItem.analysis;
                promptContext.candidateProfile.recentContext = contextClues;
                
                // Adaptive Difficulty Logic with more nuanced adjustments
                if (session.interviewMode === 'full') {
                    const recentAnswers = session.history.slice(-3).filter(h => h.analysis && typeof h.analysis.score === 'number');
                    
                    if (recentAnswers.length >= 2) {
                        const scores = recentAnswers.map(h => h.analysis.score);
                        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                        const sentiment = answerAnalysis.sentiment;

                        // More sophisticated difficulty adjustment
                        if (averageScore >= 4.2 && sentiment === 'positive' && session.currentDifficulty !== 'hard') {
                            session.currentDifficulty = 'hard';
                            promptContext.transitionText = "I can see you really know your stuff! Let me challenge you with something more complex.";
                        } else if (averageScore >= 3.8 && !answerAnalysis.emotions.includes('nervous') && session.currentDifficulty === 'easy') {
                            session.currentDifficulty = 'medium';
                            promptContext.transitionText = "You're doing great! Let's dive a bit deeper.";
                        } else if (averageScore < 2.3 && (answerAnalysis.emotions.includes('frustrated') || sentiment === 'negative')) {
                            session.currentDifficulty = 'easy';
                            promptContext.transitionText = "Let me ask you about something that might be more in your wheelhouse.";
                        }
                    }
                }
            }
        }

        // Enhanced stage transitions for full interviews with context awareness
        if (session.interviewMode === 'full') {
            const questionsInCurrentStage = session.history.filter(h => h.stage === session.currentStage).length;
            
            if (session.currentStage === 1 && questionsInCurrentStage >= 3) {
                session.currentStage = 2;
                promptContext.currentStage = 2;
                
                if (session.conversationMemory && session.conversationMemory.technicalTopics.length > 0) {
                    const mentionedTech = session.conversationMemory.technicalTopics.slice(0, 2).join(' and ');
                    promptContext.transitionText = `I'm really enjoying learning about your background! Since you mentioned ${mentionedTech}, let's dive deeper into some technical areas.`;
                } else {
                    promptContext.transitionText = "That gives me a great sense of who you are! Now I'd love to explore your technical expertise.";
                }
                
            } else if (session.currentStage === 2 && questionsInCurrentStage >= 4) {
                session.currentStage = 3;
                promptContext.currentStage = 3;
                
                const recentScores = session.history.slice(-3).filter(h => h.analysis?.score).map(h => h.analysis.score);
                if (recentScores.length > 0 && recentScores.reduce((a, b) => a + b, 0) / recentScores.length >= 3.5) {
                    promptContext.transitionText = "I'm impressed with your technical depth! For our final section, I'd love to understand how you work with teams and handle challenges.";
                } else {
                    promptContext.transitionText = "Great technical discussion! Let's wrap up by talking about teamwork and how you approach challenges.";
                }
                
            } else if (session.currentStage === 3 && questionsInCurrentStage >= 2) {
                session.status = 'completed';
                session.endReason = 'natural_conclusion';
            }
        }

        if (answer !== undefined) {
            session.messages.push({ role: 'user', content: answer });
        }

        if (session.status === 'completed') {
            const closingMessage = "This has been a really insightful conversation! I've enjoyed learning about your background and experience. We'll be in touch soon with next steps.";

            session.messages.push({ role: 'assistant', content: closingMessage });
            await session.save(); // Save final session state
            await finalizeSessionAndStartReport(session._id, 'natural_conclusion');
            
            return res.json({
                action: "END_INTERVIEW",
                dialogue: closingMessage,
                currentStage: session.currentStage,
                sessionStatus: session.status,
                conversationContext: {}
            });
        }

        const conversationContext = buildConversationContext(session, promptContext);
        promptContext.recentHistory = conversationContext;
        
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
                        source: 'ai',
                        contextualTags: session.conversationMemory?.technicalTopics || []
                    }
                },
                { upsert: true, new: true }
            );
            
            session.history.push({ 
                question: questionDoc._id, 
                timestampStart: new Date(),
                stage: session.currentStage,
                contextualHints: {
                    referencedBackground: !!promptContext.candidateProfile.recentContext,
                    emotionalTone: promptContext.lastAnswerAnalysis?.sentiment || 'neutral',
                    difficultyReason: session.currentDifficulty !== 'medium' ? 
                        `Adjusted to ${session.currentDifficulty} based on performance` : null
                }
            });
            
            session.messages.push({ role: 'assistant', content: aiResponse.dialogue });
            
        } else if (session.status !== 'completed') {
            session.status = 'completed';
            session.endReason = 'natural_conclusion';
        }

        await session.save();
        
        const responsePayload = { 
            ...aiResponse, 
            currentStage: session.currentStage,
            sessionStatus: session.status,
            conversationContext: {
                sentiment: promptContext.lastAnswerAnalysis?.sentiment,
                difficulty: session.currentDifficulty,
                backgroundUsed: !!promptContext.candidateProfile.recentContext
            }
        };
        
        res.json(responsePayload);

    } catch (err) {
        console.error("Critical error in /next-step:", err);
        res.status(500).json({ 
            message: "I'm experiencing some technical difficulties, but I don't want that to affect our conversation.", 
            error: err.message,
            action: "END_INTERVIEW",
            dialogue: "I apologize, but I'm running into some technical issues on my end. Thank you so much for the engaging conversation - I've really enjoyed learning about your experience!"
        });
    }
});
// Helper function to build conversation context with memory
function buildConversationContext(session, promptContext) {
    const recentMessages = session.messages.slice(-8); // More context for better continuity
    const contextualMessages = [];
    
    // Add conversation memory insights
    if (session.conversationMemory) {
        const memory = session.conversationMemory;
        
        if (memory.mentionedExperiences.length > 0) {
            const lastExp = memory.mentionedExperiences[memory.mentionedExperiences.length - 1];
            contextualMessages.push(`[Context: Candidate mentioned ${lastExp.type}: ${lastExp.value}]`);
        }
        
        if (memory.personalTraits.length > 0) {
            contextualMessages.push(`[Observed traits: ${memory.personalTraits.join(', ')}]`);
        }
        
        if (memory.technicalTopics.length > 0) {
            contextualMessages.push(`[Technical background: ${memory.technicalTopics.join(', ')}]`);
        }
    }
    
    // Combine contextual insights with recent messages
    return [
        ...contextualMessages,
        ...recentMessages.map(msg => `${msg.role}: ${msg.content}`)
    ].join('\n');
}

router.post('/end/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { finalAnswer, feedback } = req.body;
        
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: "I couldn't find your interview session." });
        }

        // Handle final answer with context extraction
        if (typeof finalAnswer === 'string' && finalAnswer.trim() !== '' && session.history.length > 0) {
            const lastItem = session.history[session.history.length - 1];
            if (lastItem && !lastItem.userAnswer) {
                lastItem.userAnswer = finalAnswer;
                lastItem.timestampEnd = new Date();
                
                // Extract final context clues
                const contextClues = extractContextClues(finalAnswer, session);
                updateSessionMemory(session, contextClues, finalAnswer);
                
                // Enhanced final answer analysis
                const finalAnalysis = analyzeAnswerHeuristic(finalAnswer, lastItem.question);
                lastItem.analysis = { 
                    score: 2.5, 
                    isWeak: finalAnswer.length < 20,
                    sentiment: finalAnalysis.sentiment,
                    emotions: finalAnalysis.emotions
                };
            }
        }

        // Store user feedback if provided
        if (feedback) {
            session.userFeedback = {
                rating: feedback.rating,
                comments: feedback.comments,
                experience: feedback.experience,
                submittedAt: new Date()
            };
        }

        session.status = 'completed';
        session.endReason = session.endReason || 'user_ended';
        session.lastActivity = new Date();
        
        await session.save();

        // Generate a more personal closing message
        let closingMessage = "Thank you for such an engaging conversation! ";
        
        if (session.conversationMemory?.personalTraits.includes('proud')) {
            closingMessage += "I could really sense your passion for your work, which is wonderful to see. ";
        }
        
        if (session.conversationMemory?.technicalTopics.length > 0) {
            closingMessage += `It was particularly interesting hearing about your experience with ${session.conversationMemory.technicalTopics.slice(0, 2).join(' and ')}. `;
        }
        
        closingMessage += "We'll be processing everything we discussed and will get back to you with next steps soon.";

        res.status(200).json({ 
            message: closingMessage,
            sessionId: session._id,
            sessionSummary: {
                duration: session.getSessionDurationMinutes ? session.getSessionDurationMinutes() : null,
                questionsAnswered: session.history.filter(h => h.userAnswer).length,
                technicalTopicsDiscussed: session.conversationMemory?.technicalTopics || [],
                overallSentiment: session.history.length > 0 ? 
                    session.history[session.history.length - 1]?.analysis?.sentiment || 'positive' : 'positive'
            }
        });
        
    } catch (error) {
        console.error("Error ending session:", error);
        res.status(500).json({ 
            message: "I had trouble saving our conversation, but thank you for the great interview!", 
            error: error.message 
        });
    }
});

router.get('/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId)
            .populate('history.question')
            .lean(); // Use lean for better performance
            
        if (!session) {
            return res.status(404).json({ message: "Interview session not found." });
        }
        
        // Add computed fields for better frontend integration
        const enhancedSession = {
            ...session,
            computedMetrics: {
                averageSentiment: session.history.length > 0 ? 
                    calculateAverageSentiment(session.history) : 'neutral',
                backgroundUtilization: session.conversationMemory ? 
                    (session.conversationMemory.mentionedExperiences || []).length : 0,
                conversationDepth: session.messages.length,
                technicalBreadth: session.conversationMemory ? 
                    (session.conversationMemory.technicalTopics || []).length : 0
            }
        };
        
        res.json(enhancedSession);
    } catch (err) {
        console.error("Error fetching session:", err);
        res.status(500).json({ 
            message: "Error retrieving interview session", 
            error: err.message 
        });
    }
});

// Helper function to calculate average sentiment
function calculateAverageSentiment(history) {
    const sentiments = history
        .filter(h => h.analysis?.sentiment)
        .map(h => h.analysis.sentiment);
        
    if (sentiments.length === 0) return 'neutral';
    
    const sentimentScores = {
        'positive': 1,
        'neutral': 0,
        'uncertain': -0.5,
        'negative': -1
    };
    
    const avgScore = sentiments.reduce((sum, sentiment) => 
        sum + (sentimentScores[sentiment] || 0), 0) / sentiments.length;
        
    if (avgScore > 0.3) return 'positive';
    if (avgScore < -0.3) return 'negative';
    return 'neutral';
}

router.post('/code/submit', async (req, res) => {
    const { source_code, language_id } = req.body;
    
    if (!source_code) {
        return res.status(400).json({ message: 'Please provide your code solution to proceed.' });
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
        timeout: 15000 // Increased timeout for better reliability
    };
    
    try {
        const response = await axios.request(options);
        res.json({
            ...response.data,
            message: response.data.status?.description === "Accepted" ? 
                "Great! Your code executed successfully." : 
                "I see there might be an issue with the execution. Let's discuss your approach."
        });
    } catch (err) {
        console.error("Code execution error:", err);
        res.status(500).json({ 
            message: "I'm having trouble running your code right now, but we can definitely discuss your solution approach instead.",
            error: err.response?.data || err.message,
            fallback: true
        });
    }
});

module.exports = router;