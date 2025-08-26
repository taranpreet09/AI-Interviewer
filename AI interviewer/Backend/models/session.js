// /models/Session.js
// MODIFIED - Added role, company, and roundType to the session context

const mongoose = require('mongoose');

// ... (All sub-schemas like scoreSchema, reportSchema, etc., remain the same as in Phase 2)
const scoreSchema = new mongoose.Schema({
    clarity: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    starCompleteness: { type: Number, default: 0 },
}, { _id: false });

const behavioralReportSchema = new mongoose.Schema({
    questionText: String,
    scores: scoreSchema,
    feedback: String,
}, { _id: false });

const theoryReportSchema = new mongoose.Schema({
    questionText: String,
    score: { type: Number, default: 0 },
    feedback: String,
}, { _id: false });

const codingReportSchema = new mongoose.Schema({
    questionText: String,
    correctness: String,
    timeComplexity: String,
    spaceComplexity: String,
    readability: String,
    feedback: String,
}, { _id: false });

const reportSchema = new mongoose.Schema({
    summary: { type: String, default: '' },
    behavioralAnalysis: [behavioralReportSchema],
    theoryAnalysis: [theoryReportSchema],
    codingAnalysis: [codingReportSchema],
    finalScores: {
        behavioral: { score: Number, feedback: String },
        theory: { score: Number, feedback: String },
        coding: { score: Number, feedback: String },
    }
}, { _id: false });


const questionSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ['behavioral', 'theory', 'coding'] },
    text: { type: String, required: true },
    userAnswer: { type: String, default: '' },
    codeResult: {
        stdout: { type: String, default: null },
        stderr: { type: String, default: null },
        status: { type: String, default: null },
    },
});

const sessionSchema = new mongoose.Schema({
    // New context fields
    role: { type: String, required: true },
    company: { type: String, default: 'N/A' },
    interviewType: { // This was 'roundType' in the prompt, using existing 'interviewType' for consistency
        type: String,
        required: true,
        enum: ['DSA', 'System Design', 'HR', 'Behavioral', 'Technical']
    },
    
    questions: [questionSchema],
    currentQuestionIndex: { type: Number, default: 0 },
    status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
    report: { type: reportSchema, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);