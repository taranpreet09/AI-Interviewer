const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
    score: { type: Number, default: 0 },
    isWeak: { type: Boolean, default: false },
}, { _id: false });

const historyItemSchema = new mongoose.Schema({
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    userAnswer: { type: String, default: '' },
    isFollowUp: { type: Boolean, default: false },
    followUpText: { type: String, default: null },
    analysis: analysisSchema,
    timestampStart: { type: Date },
    timestampEnd: { type: Date },
});

const sessionSchema = new mongoose.Schema({
    role: { type: String, required: true },
    company: { type: String, default: 'N/A' },
    interviewType: { type: String, required: true },
    messages: { type: Array, default: [] },
    history: [historyItemSchema],
    
    status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
    currentDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    report: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);