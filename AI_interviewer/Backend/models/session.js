const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
    score: { 
        type: Number, 
        default: 0,
        min: 0,
        max: 5
    },
    isWeak: { 
        type: Boolean, 
        default: false 
    },
    isRude: { 
        type: Boolean, 
        default: false 
    },
    evaluationMethod: {
        type: String,
        enum: ['ai', 'heuristic', 'manual'],
        default: 'ai'
    },
    evaluatedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const historyItemSchema = new mongoose.Schema({
    question: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Question',
        required: true
    },
    userAnswer: { 
        type: String, 
        default: '',
        maxlength: 5000 // Prevent extremely long answers
    },
    isFollowUp: { 
        type: Boolean, 
        default: false 
    },
    followUpText: { 
        type: String, 
        default: null,
        maxlength: 1000
    },
    analysis: {
        type: analysisSchema,
        default: () => ({})
    },
    timestampStart: { 
        type: Date,
        default: Date.now
    },
    timestampEnd: { 
        type: Date,
        default: null
    },
    stage: {
        type: Number,
        min: 1,
        max: 3,
        default: 1
    },
    // Track response time for analytics
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

// Add indexes for better query performance
historyItemSchema.index({ timestampStart: 1 });
historyItemSchema.index({ stage: 1 });

const sessionSchema = new mongoose.Schema({
    role: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    warnings: {
        type: Number,
        default: 0
    },
    company: { 
        type: String, 
        default: 'Tech Company',
        trim: true,
        maxlength: 100
    },
    interviewType: { 
    type: String, 
    required: true,
    enum: ['Behavioral', 
    'System Design', 
    'Coding Challenge', 
    'Technical Screen',
    'Full Simulation'], // Added new type
    trim: true
},
    history: [historyItemSchema],
    
    // Limit message storage to prevent memory bloat
    messages: { 
        type: Array, 
        default: [],
        validate: {
            validator: function(messages) {
                return messages.length <= 50; // Max 50 messages
            },
            message: 'Too many messages stored. Session may need cleanup.'
        }
    },
    
    status: { 
        type: String, 
        enum: ['ongoing', 'completed', 'abandoned', 'error'], 
        default: 'ongoing',
        index: true
    },
    
    currentDifficulty: { 
        type: String, 
        enum: ['easy', 'medium', 'hard'], 
        default: 'medium' 
    },
    
    report: { 
        type: Object,
        default: null
    },
    
    reportGeneratedAt: {
        type: Date,
        default: null
    },

    // Interview mode and stage tracking
    interviewMode: {
        type: String,
        enum: ['full', 'specific'],
        required: true
    },
    
    currentStage: {
        type: Number,
        min: 1,
        max: 3,
        default: 1,
        validate: {
            validator: function(stage) {
                // Only validate stage for full interviews
                if (this.interviewMode === 'specific') return true;
                return stage >= 1 && stage <= 3;
            },
            message: 'Invalid stage for interview mode'
        }
    },

    // Session lifecycle tracking
    endReason: {
        type: String,
        enum: ['natural_conclusion', 'user_ended', 'time_limit', 'technical_error', 'inappropriate_behavior'],
        default: null
    },
    
    lastActivity: {
        type: Date,
        default: Date.now
    },
    
    // Performance and quality metrics
    totalQuestions: {
        type: Number,
        default: 0
    },
    
    averageResponseTime: {
        type: Number,
        default: null
    },
    
    // Metadata for analytics
    userAgent: {
        type: String,
        default: null
    },
    
    ipAddress: {
        type: String,
        default: null
    }

}, { 
    timestamps: true,
    // Add indexes for common queries
    indexes: [
        { status: 1, createdAt: -1 },
        { interviewType: 1, interviewMode: 1 },
        { lastActivity: 1 }
    ]
});

// Pre-save middleware to update computed fields
sessionSchema.pre('save', function(next) {
    // Update total questions count
    this.totalQuestions = this.history.length;
    
    // Update last activity
    this.lastActivity = new Date();
    
    // Calculate average response time
    const completedItems = this.history.filter(item => 
        item.timestampStart && item.timestampEnd
    );
    
    if (completedItems.length > 0) {
        const totalTime = completedItems.reduce((sum, item) => {
            return sum + (item.timestampEnd - item.timestampStart);
        }, 0);
        
        this.averageResponseTime = Math.round(totalTime / completedItems.length / 1000); // in seconds
    }
    
    // Cleanup old messages if too many
    if (this.messages && this.messages.length > 50) {
        // Keep first message (greeting) and last 45 messages
        this.messages = [
            this.messages[0],
            ...this.messages.slice(-44)
        ];
    }
    
    next();
});

// Static methods for common queries
sessionSchema.statics.findActiveSessionsOlderThan = function(hours) {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.find({
        status: 'ongoing',
        lastActivity: { $lt: cutoffTime }
    });
};

sessionSchema.statics.findCompletedSessionsNeedingCleanup = function(days) {
    const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return this.find({
        status: 'completed',
        updatedAt: { $lt: cutoffTime },
        'messages.50': { $exists: true } // Sessions with more than 50 messages
    });
};

// Instance methods
sessionSchema.methods.isExpired = function(maxHours = 24) {
    const expiryTime = new Date(this.lastActivity.getTime() + (maxHours * 60 * 60 * 1000));
    return new Date() > expiryTime;
};

sessionSchema.methods.getSessionDurationMinutes = function() {
    if (this.status !== 'completed') return null;
    return Math.round((this.lastActivity - this.createdAt) / (1000 * 60));
};
// At the end of models/session.js
module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);