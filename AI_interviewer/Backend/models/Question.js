const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
    source: { type: String, required: true, enum: ['seed', 'ai'], default: 'ai' },
    tags: [String],
    language_id: { type: Number, default: null },
    idealAnswer: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);