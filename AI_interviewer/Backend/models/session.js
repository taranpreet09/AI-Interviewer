const mongoose = require('mongoose');

const questionDataSchema = new mongoose.Schema({
    text: String,
    type: String,
    difficulty: String,
    questionSource: { type: String, enum: ['AI', 'Bank'], default: 'Bank' },
    language_id: { type: Number, default: null }
}, { _id: false });

const analysisSchema = new mongoose.Schema({
    score: { type: Number, default: 0 },
    isWeak: { type: Boolean, default: false },
}, { _id: false });

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['ai', 'user'] },
    text: { type: String, required: true },
    type: { // The nature of the AI's message
        type: String,
       enum: ['greeting', 'question', 'followup', 'acknowledgment', 'closing', 'answer'],
        default: 'question'
    },
    analysis: analysisSchema, // Analysis of the user's answer
}, { timestamps: true });


const historyItemSchema = new mongoose.Schema({
    question: questionDataSchema,
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
    
    messages: [messageSchema], // Renamed from 'history'

    status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
    currentDifficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    // We can keep the final report structure if needed, or generate it from messages
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);