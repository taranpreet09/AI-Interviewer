const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const { evaluateBehavioral, evaluateTheory, evaluateCoding, generateFinalSummary } = require('../utils/aiEvaluator');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

// --- Report Schema Definition ---
const reportSchema = new mongoose.Schema({
    session: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Session',
        required: true,
        unique: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        required: true
    },
    role: { type: String, required: true },
    company: { type: String },
    summary: {
        strengths: { type: String, default: 'N/A' },
        weaknesses: { type: String, default: 'N/A' },
        nextSteps: { type: String, default: 'N/A' }
    },
    overallScore: { type: Number, min: 0, max: 5, default: 0 },
    finalScores: {
        behavioral: { type: Number, default: 0 },
        theory: { type: Number, default: 0 },
        coding: { type: Number, default: 0 }
    },
    detailedFeedback: [{
        question: String,
        category: String,
        answer: String,
        score: Number,
        details: String,
        tips: String
    }],
    metadata: {
        totalQuestions: Number,
        answeredQuestions: Number,
        sessionDurationMinutes: Number,
        processingErrors: [String]
    }
}, { timestamps: true });
const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);


// --- Session Schema Definition ---
const analysisSchema = new mongoose.Schema({
    score: { type: Number, default: 0, min: 0, max: 5 },
    isWeak: { type: Boolean, default: false },
    isRude: { type: Boolean, default: false },
    evaluationMethod: { type: String, enum: ['ai', 'heuristic', 'manual'], default: 'ai' },
    evaluatedAt: { type: Date, default: Date.now }
}, { _id: false });

const historyItemSchema = new mongoose.Schema({
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    userAnswer: { type: String, default: '', maxlength: 5000 },
    isFollowUp: { type: Boolean, default: false },
    followUpText: { type: String, default: null, maxlength: 1000 },
    analysis: { type: analysisSchema, default: () => ({}) },
    timestampStart: { type: Date, default: Date.now },
    timestampEnd: { type: Date, default: null },
    stage: { type: Number, min: 1, max: 3, default: 1 },
    responseTimeSeconds: {
        type: Number,
        min: 0,
        default: function() {
            if (this.timestampStart && this.timestampEnd) {
                return Math.round((this.timestampEnd - this.timestampStart) / 1000);
            }
            return null;
        }
    }
});
historyItemSchema.index({ timestampStart: 1 });
historyItemSchema.index({ stage: 1 });

const sessionSchema = new mongoose.Schema({
    role: { type: String, required: true, trim: true, maxlength: 100 },
    warnings: { type: Number, default: 0 },
    company: { type: String, default: 'Tech Company', trim: true, maxlength: 100 },
    candidateContext: { type: String, default: null, maxlength: 2000 },
    interviewType: { 
        type: String, 
        required: true,
        enum: ['Behavioral', 'System Design', 'Coding Challenge', 'Technical Screen', 'Full Simulation'],
        trim: true
    },
    history: [historyItemSchema],
    messages: { 
        type: Array, 
        default: [],
        validate: {
            validator: function(messages) { return messages.length <= 50; },
            message: 'Too many messages stored.'
        }
    },
    status: { type: String, enum: ['ongoing', 'completed', 'abandoned', 'error'], default: 'ongoing', index: true },
    currentDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    report: { type: Object, default: null },
    reportGeneratedAt: { type: Date, default: null },
    interviewMode: { type: String, enum: ['full', 'specific'], required: true },
    currentStage: {
        type: Number,
        min: 1,
        max: 3,
        default: 1,
        validate: {
            validator: function(stage) {
                if (this.interviewMode === 'specific') return true;
                return stage >= 1 && stage <= 3;
            },
            message: 'Invalid stage for interview mode'
        }
    },
    endReason: { type: String, enum: ['natural_conclusion', 'user_ended', 'time_limit', 'technical_error', 'inappropriate_behavior'], default: null },
    lastActivity: { type: Date, default: Date.now },
    totalQuestions: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null }
}, { 
    timestamps: true,
    indexes: [
        { status: 1, createdAt: -1 },
        { interviewType: 1, interviewMode: 1 },
        { lastActivity: 1 }
    ]
});
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);


// --- Worker Queue and Logic ---
const reportQueue = new Queue('report-generation', { connection });

const worker = new Worker('report-generation', async job => {
  const { reportId, sessionId } = job.data;
  console.log(`[WORKER] Starting report generation for reportId: ${reportId}`);

  try {
    //
    // ▼▼▼ --- THE FIX --- ▼▼▼
    // The polling 'while' loop is removed. We now fetch directly,
    // as jobs will only be dispatched for sessions that are already 'completed'.
    //
    const session = await Session.findById(sessionId).populate('history.question');

    if (!session || session.status !== 'completed') {
        throw new Error(`Session ${sessionId} is not in a 'completed' state. Aborting report.`);
    }
    //
    // ▲▲▲ --- END OF THE FIX --- ▲▲▲
    //

    await Report.findByIdAndUpdate(reportId, {
      status: 'processing',
      role: session.role,
      company: session.company
    });

    const detailedFeedback = [];
    const categoryScores = { behavioral: [], theory: [], coding: [] };
    const processingErrors = [];

    for (const item of session.history) {
      if (!item.userAnswer || !item.question) {
        continue;
      }
      let feedbackItem = null;
      const { category, text } = item.question;
      try {
        if (category === 'behavioral') { feedbackItem = await evaluateBehavioral(text, item.userAnswer); }
        else if (category === 'theory') { feedbackItem = await evaluateTheory(text, item.question.idealAnswer, item.userAnswer); }
        else if (category === 'coding') { feedbackItem = await evaluateCoding(text, item.userAnswer); }
        
        if (feedbackItem && feedbackItem.score) {
            categoryScores[category].push(feedbackItem.score);
            detailedFeedback.push({
                question: text, category,
                answer: item.userAnswer.substring(0, 500),
                score: Math.round(feedbackItem.score * 10) / 10,
                details: feedbackItem.details || "Evaluation completed",
                tips: feedbackItem.tips || "Keep practicing"
            });
        }
      } catch (error) {
          console.error(`[WORKER] Error evaluating item:`, error);
          processingErrors.push(error.message);
      }
    }
        
    const summary = await generateFinalSummary(detailedFeedback);
    if (summary && Array.isArray(summary.nextSteps)) {
      summary.nextSteps = summary.nextSteps.join('\n• ');
      if (summary.nextSteps) {
          summary.nextSteps = '• ' + summary.nextSteps;
      }
    }

    const finalScoresCalc = {
        behavioral: categoryScores.behavioral.length ? categoryScores.behavioral.reduce((a,b)=>a+b,0)/categoryScores.behavioral.length : 0,
        theory: categoryScores.theory.length ? categoryScores.theory.reduce((a,b)=>a+b,0)/categoryScores.theory.length : 0,
        coding: categoryScores.coding.length ? categoryScores.coding.reduce((a,b)=>a+b,0)/categoryScores.coding.length : 0,
    };
    const validScores = Object.values(finalScoresCalc).filter(score => score > 0);
    const overallScore = validScores.length ? validScores.reduce((a,b)=>a+b,0)/validScores.length : 0;

    const finalReportData = {
        status: 'completed',
        summary: summary,
        overallScore: Math.round(overallScore * 10) / 10,
        finalScores: {
            behavioral: Math.round(finalScoresCalc.behavioral * 10) / 10,
            theory: Math.round(finalScoresCalc.theory * 10) / 10,
            coding: Math.round(finalScoresCalc.coding * 10) / 10,
        },
        detailedFeedback: detailedFeedback,
        metadata: { 
            totalQuestions: session.history.length,
            answeredQuestions: detailedFeedback.length,
            processingErrors: processingErrors
        }
    };
    
    await Report.findByIdAndUpdate(reportId, finalReportData);
    console.log(`[WORKER] Successfully completed report for reportId: ${reportId}`);

  } catch (error) {
    console.error(`[WORKER] Failed to process report for reportId: ${reportId}`, error);
    await Report.findByIdAndUpdate(reportId, { status: 'failed' });
    throw error;
  }
}, { connection });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});
worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = { reportQueue };