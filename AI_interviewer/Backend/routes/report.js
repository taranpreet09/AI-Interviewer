const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const Question = require('../models/Question');
const { evaluateBehavioral, evaluateTheory, evaluateCoding, generateFinalSummary } = require('../utils/aiEvaluator');

const delay = ms => new Promise(res => setTimeout(res, ms));

router.get('/analyze/session/:sessionId', async (req, res) => {
    try {
        let session = null;
        let attempts = 10; // Increased attempts for better reliability
        const pollInterval = 1500; // 1.5 seconds between attempts

        console.log(`[REPORT] Starting report generation for session: ${req.params.sessionId}`);

        // Enhanced polling logic to handle race conditions
        while (attempts > 0) {
            session = await Session.findById(req.params.sessionId).populate('history.question');
            
            if (session && session.status === 'completed') {
                console.log(`[REPORT] Found completed session after ${11 - attempts} attempts`);
                break;
            }
            
            if (!session) {
                console.log(`[REPORT] Session not found, attempts remaining: ${attempts - 1}`);
            } else {
                console.log(`[REPORT] Session status: ${session.status}, attempts remaining: ${attempts - 1}`);
            }
            
            // Wait before next attempt
            await delay(pollInterval);
            attempts--;
        }

        if (!session) {
            return res.status(404).json({ 
                message: "Session not found. Please verify the session ID.",
                sessionId: req.params.sessionId
            });
        }

        if (session.status !== 'completed') {
            return res.status(400).json({ 
                message: "Session is not completed yet. Please end the interview first.",
                sessionStatus: session.status,
                sessionId: req.params.sessionId
            });
        }

        // Return existing report if available
        if (session.report && session.report.detailedFeedback && session.report.detailedFeedback.length > 0) {
            console.log("[REPORT] Returning existing report from database");
            return res.json(session.report);
        }

        console.log(`[REPORT] Generating new report with ${session.history.length} history items`);

        const detailedFeedback = [];
        const categoryScores = { behavioral: [], theory: [], coding: [] };
        const processingErrors = [];

        // Process each history item for evaluation
        for (let i = 0; i < session.history.length; i++) {
            const item = session.history[i];
            
            if (!item.userAnswer || !item.question) {
                console.log(`[REPORT] Skipping item ${i}: missing answer or question`);
                continue;
            }
            
            let feedbackItem = null;
            const { category, text } = item.question;

            try {
                console.log(`[REPORT] Evaluating ${category} question ${i + 1}/${session.history.length}`);

                if (category === 'behavioral') {
                    feedbackItem = await evaluateBehavioral(text, item.userAnswer);
                } else if (category === 'theory') {
                    feedbackItem = await evaluateTheory(text, item.question.idealAnswer, item.userAnswer);
                } else if (category === 'coding') {
                    feedbackItem = await evaluateCoding(text, item.userAnswer);
                    
                    // Combine AI evaluation with execution results if available
                    if (feedbackItem && item.analysis && item.analysis.score) {
                        const executionScore = item.analysis.score || 3.0;
                        feedbackItem.score = (feedbackItem.score + executionScore) / 2;
                    }
                }
                
                if (feedbackItem && feedbackItem.score) {
                    categoryScores[category].push(feedbackItem.score);
                    detailedFeedback.push({
                        question: text,
                        category: category,
                        answer: item.userAnswer.substring(0, 500), // Limit answer length for display
                        score: Math.round(feedbackItem.score * 10) / 10, // Round to 1 decimal
                        details: feedbackItem.details || "Evaluation completed",
                        tips: feedbackItem.tips || "Keep practicing"
                    });
                } else {
                    console.warn(`[REPORT] No feedback generated for item ${i}`);
                }
                
            } catch (error) {
                console.error(`[REPORT] Error evaluating item ${i}:`, error);
                processingErrors.push(`Question ${i + 1}: ${error.message}`);
                
                // Add fallback feedback for failed evaluations
                detailedFeedback.push({
                    question: text,
                    category: category,
                    answer: item.userAnswer.substring(0, 500),
                    score: 2.5, // Default score
                    details: "Unable to generate detailed evaluation",
                    tips: "Continue practicing this type of question"
                });
            }
        }

        console.log(`[REPORT] Processed ${detailedFeedback.length} items, generating summary...`);

        // Generate final summary
        let summary = null;
        try {
            summary = await generateFinalSummary(detailedFeedback);
        } catch (error) {
            console.error("[REPORT] Summary generation failed:", error);
            summary = {
                strengths: "Interview participation and effort",
                weaknesses: "Areas for development identified during analysis",
                nextSteps: "Continue practicing interview skills and technical knowledge"
            };
        }

        // Calculate final scores by category
        const finalScores = {
            behavioral: categoryScores.behavioral.length > 0 
                ? Math.round((categoryScores.behavioral.reduce((a, b) => a + b, 0) / categoryScores.behavioral.length) * 10) / 10
                : 0,
            theory: categoryScores.theory.length > 0 
                ? Math.round((categoryScores.theory.reduce((a, b) => a + b, 0) / categoryScores.theory.length) * 10) / 10
                : 0,
            coding: categoryScores.coding.length > 0 
                ? Math.round((categoryScores.coding.reduce((a, b) => a + b, 0) / categoryScores.coding.length) * 10) / 10
                : 0,
        };

        // Calculate overall score
        const validScores = Object.values(finalScores).filter(score => score > 0);
        const overallScore = validScores.length > 0 
            ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
            : 0;

        const finalReport = {
            candidate: "Candidate",
            role: session.role,
            company: session.company,
            round: session.interviewType,
            interviewMode: session.interviewMode,
            currentStage: session.currentStage,
            overallScore: overallScore,
            finalScores: finalScores,
            summary: summary || { 
                strengths: "Interview completed successfully", 
                weaknesses: "Areas for improvement identified", 
                nextSteps: "Continue skill development" 
            },
            detailedFeedback: detailedFeedback,
            metadata: {
                totalQuestions: session.history.length,
                answeredQuestions: detailedFeedback.length,
                processingErrors: processingErrors.length,
                generatedAt: new Date(),
                sessionDuration: session.lastActivity ? 
                    Math.round((new Date(session.lastActivity) - new Date(session.createdAt)) / 1000 / 60) : null
            }
        };

        // Save report to session
        session.report = finalReport;
        session.reportGeneratedAt = new Date();
        await session.save();

        console.log(`[REPORT] Report generated successfully with overall score: ${overallScore}`);

        res.json(finalReport);

    } catch (error) {
        console.error("[REPORT] Critical error in report generation:", error);
        res.status(500).json({ 
            message: "Error generating report", 
            error: error.message,
            sessionId: req.params.sessionId,
            timestamp: new Date()
        });
    }
});

module.exports = router;