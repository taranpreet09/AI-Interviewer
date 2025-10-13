// const express = require('express');
// const router = express.Router();
// const Session = require('../models/session');
// const Report = require('../models/report.model');
// const Question = require('../models/Question');
// const { reportQueue } = require('../services/reportWorker');
// const { evaluateBehavioral, evaluateTheory, evaluateCoding, generateFinalSummary } = require('../utils/aiEvaluator');

// const delay = ms => new Promise(res => setTimeout(res, ms));

// router.get('/analyze/session/:sessionId', async (req, res) => {
//     const { sessionId } = req.params;
//     let session = null;
//     let reportDocument = null; 

//     try {
//         const existingReport = await Report.findOne({ session: sessionId });

//         if (existingReport && existingReport.status === 'completed') {
//             console.log(`[REPORT] Returning existing completed report for session: ${sessionId}`);
//             return res.json(existingReport);
//         }

//         if (existingReport && (existingReport.status === 'processing' || existingReport.status === 'pending')) {
//             console.log(`[REPORT] Report generation is already in progress for session: ${sessionId}`);
//             return res.status(202).json({ 
//                 message: "Report generation is already in progress. Please check back shortly.",
//                 reportId: existingReport._id 
//             });
//         }
        
//         let attempts = 10;
//         const pollInterval = 1500;
//         console.log(`[REPORT] No existing report found. Starting generation for session: ${sessionId}`);

//         while (attempts > 0) {
//             session = await Session.findById(sessionId).populate('history.question');
//             if (session && session.status === 'completed') {
//                 console.log(`[REPORT] Found completed session after ${11 - attempts} attempts`);
//                 break;
//             }
//             await delay(pollInterval);
//             attempts--;
//         }
        
//         if (!session || session.status !== 'completed') {
//              const message = !session ? "Session not found." : "Session is not completed yet.";
//             return res.status(!session ? 404 : 400).json({ message, sessionId: sessionId });
//         }

//         console.log('[REPORT] Creating initial report document.');
//         reportDocument = new Report({
//             session: sessionId,
//             status: 'processing',
//             role: session.role,
//             company: session.company
//         });
//         await reportDocument.save();

//         const detailedFeedback = [];
//         const categoryScores = { behavioral: [], theory: [], coding: [] };
//         const processingErrors = [];

//         for (const item of session.history) {
//             if (!item.userAnswer) continue;
//              if (!item.question) {
//                 console.warn(`[REPORT] Skipping a history item because its associated question (ID: ${item.question}) could not be found or populated.`);
//                 continue;
//             }
//             let feedbackItem = null;
//             const { category, text } = item.question;
//             try {
//                 if (category === 'behavioral') { feedbackItem = await evaluateBehavioral(text, item.userAnswer); }
//                 else if (category === 'theory') { feedbackItem = await evaluateTheory(text, item.question.idealAnswer, item.userAnswer); }
//                 else if (category === 'coding') { feedbackItem = await evaluateCoding(text, item.userAnswer); }
                
//                 if (feedbackItem && feedbackItem.score) {
//                     categoryScores[category].push(feedbackItem.score);
//                     detailedFeedback.push({
//                         question: text, category,
//                         answer: item.userAnswer.substring(0, 500),
//                         score: Math.round(feedbackItem.score * 10) / 10,
//                         details: feedbackItem.details || "Evaluation completed",
//                         tips: feedbackItem.tips || "Keep practicing"
//                     });
//                 }
//             } catch (error) {
//                 console.error(`[REPORT] Error evaluating item:`, error);
//                 processingErrors.push(error.message);
//             }
//         }
        
//         const summary = await generateFinalSummary(detailedFeedback);
        
//         const finalScoresCalc = {
//             behavioral: categoryScores.behavioral.length ? categoryScores.behavioral.reduce((a,b)=>a+b,0)/categoryScores.behavioral.length : 0,
//             theory: categoryScores.theory.length ? categoryScores.theory.reduce((a,b)=>a+b,0)/categoryScores.theory.length : 0,
//             coding: categoryScores.coding.length ? categoryScores.coding.reduce((a,b)=>a+b,0)/categoryScores.coding.length : 0,
//         };
//         const validScores = Object.values(finalScoresCalc).filter(score => score > 0);
//         const overallScore = validScores.length ? validScores.reduce((a,b)=>a+b,0)/validScores.length : 0;

//         const finalReportData = {
//             status: 'completed',
//             summary: summary,
//             overallScore: Math.round(overallScore * 10) / 10,
//             finalScores: {
//                 behavioral: Math.round(finalScoresCalc.behavioral * 10) / 10,
//                 theory: Math.round(finalScoresCalc.theory * 10) / 10,
//                 coding: Math.round(finalScoresCalc.coding * 10) / 10,
//             },
//             detailedFeedback: detailedFeedback,
//             metadata: { 
//                 totalQuestions: session.history.length,
//                 answeredQuestions: detailedFeedback.length,
//                 processingErrors: processingErrors
//             }
//         };

//         const finishedReport = await Report.findByIdAndUpdate(reportDocument._id, finalReportData, { new: true });
        
//         console.log(`[REPORT] Report generated successfully with ID: ${finishedReport._id}`);
//         res.json(finishedReport);

//     } catch (error) {
//         console.error("[REPORT] Critical error in report generation:", error);
        
//         if (reportDocument && reportDocument._id) {
//             await Report.findByIdAndUpdate(reportDocument._id, { status: 'failed' });
//         }
        
//         res.status(500).json({ 
//             message: "A critical error occurred while generating the report.", 
//             error: error.message,
//             sessionId: sessionId
//         });
//     }
// });

// module.exports = router;
// In routes/report.js

// In routes/report.js
// routes/report.js
// AI_interviewer/Backend/routes/report.js

const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const Report = require('../models/report.model');
const { reportQueue } = require('../services/reportWorker');

/**
 * Main endpoint to get or initiate a report for a session.
 * This is the only endpoint the frontend should call initially.
 * It will either return a completed report or start the generation process.
 */
router.get('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        // 1. Check if a report already exists for this session
        let report = await Report.findOne({ session: sessionId });

        if (report) {
            // If the report is already complete, send it immediately
            if (report.status === 'completed') {
                console.log(`[API] Returning existing completed report ${report._id} for session ${sessionId}.`);
                return res.status(200).json(report);
            }
            // If it's still being processed, tell the client to start polling
            console.log(`[API] Report ${report._id} is already processing for session ${sessionId}.`);
            return res.status(202).json({ 
                reportId: report._id, 
                message: "Report generation in progress." 
            });
        }

        // 2. If no report exists, we need to create one and start the process
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: "The interview session for this report could not be found." });
        }

        // IMPORTANT: Only create a report if the interview is actually finished
        if (session.status !== 'completed') {
             return res.status(400).json({ message: "The interview session is not yet complete. Please finish the interview first." });
        }
        
        // Create the new report document with a 'pending' status
        const newReport = new Report({
            session: sessionId,
            status: 'pending',
            role: session.role,
            company: session.company
        });
        await newReport.save();
        
        // Add the generation job to the queue for our background worker
        await reportQueue.add('generate-report', {
            reportId: newReport._id,
            sessionId: sessionId
        });

        console.log(`[API] New report ${newReport._id} created and queued for session ${sessionId}.`);
        
        // Respond with 202 Accepted, telling the client to start polling this new reportId
        return res.status(202).json({ 
            reportId: newReport._id, 
            message: "Report generation has been queued." 
        });

    } catch (error) {
        console.error("[API] Error in /report/session/:sessionId endpoint:", error);
        res.status(500).json({ message: "Server error while initiating report analysis." });
    }
});


/**
 * Checks the status of a report by its Report ID.
 * This is the endpoint the client will poll to check for completion.
 */
router.get('/status/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const report = await Report.findById(reportId);

        if (!report) {
            return res.status(404).json({ message: "Report not found." });
        }

        // If the report is complete, send the full report data
        if (report.status === 'completed') {
            return res.status(200).json({ status: report.status, data: report });
        }
        
        // Otherwise, just send the current status (e.g., 'pending' or 'processing')
        res.status(200).json({ status: report.status });

    } catch (error) {
        console.error("[API] Error fetching report status:", error);
        res.status(500).json({ message: "Error fetching report status." });
    }
});

module.exports = router;