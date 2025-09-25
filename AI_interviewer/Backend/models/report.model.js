const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // --- Core Relationships ---
    session: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Session',
        required: true,
        unique: true, // A session can only have one report
        index: true
    },
    user: { // For your future login/signup feature
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        index: true
    },
    
    // --- Generation Status ---
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        required: true
    },

    // --- Report Content (mirrors your existing structure) ---
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
    
    // --- Metadata ---
    metadata: {
        totalQuestions: Number,
        answeredQuestions: Number,
        sessionDurationMinutes: Number,
        processingErrors: [String]
    }

}, { timestamps: true });

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);