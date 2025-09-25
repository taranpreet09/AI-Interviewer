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
    emotions: [{
        type: String,
        enum: ['nervous', 'confident', 'excited', 'frustrated', 'thoughtful', 'apologetic','angry']
    }],
    sentiment: {
        type: String,
        enum: ['positive', 'negative', 'neutral', 'uncertain'],
        default: 'neutral'
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

const contextualHintSchema = new mongoose.Schema({
    referencedBackground: {
        type: Boolean,
        default: false
    },
    emotionalTone: {
        type: String,
        enum: ['positive', 'negative', 'neutral', 'uncertain'],
        default: 'neutral'
    },
    difficultyReason: {
        type: String,
        default: null
    },
    personalizedElements: [{
        type: String // Things like mentioned companies, projects, etc.
    }]
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
        maxlength: 5000
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
    contextualHints: {
        type: contextualHintSchema,
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

// Conversation memory schema to track context across the interview
const conversationMemorySchema = new mongoose.Schema({
    mentionedExperiences: [{
        type: {
            type: String,
            enum: ['company', 'project', 'skill', 'achievement', 'challenge']
        },
        value: [String], // Array to handle multiple values
        context: String, // Short excerpt of where this was mentioned
        mentionedAt: {
            type: Date,
            default: Date.now
        }
    }],
    technicalTopics: [{
        type: String,
        lowercase: true
    }],
    personalTraits: [{
        type: String,
        enum: ['confident', 'analytical', 'collaborative', 'proud', 'challenged', 'learned', 'needs_encouragement']
    }],
    backgroundHighlights: [{
        topic: String,
        details: String,
        relevance: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium'
        }
    }],
    conversationFlow: [{
        stage: Number,
        topic: String,
        engagement: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { _id: false });

const userFeedbackSchema = new mongoose.Schema({
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    comments: {
        type: String,
        maxlength: 1000
    },
    experience: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor']
    },
    suggestions: {
        type: String,
        maxlength: 500
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
    role: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    company: { 
        type: String, 
        default: 'Tech Company',
        trim: true,
        maxlength: 100
    },
    candidateContext: {
        type: String,
        maxlength: 2000,
        trim: true
    },
    interviewType: { 
        type: String, 
        required: true,
        enum: ['Behavioral', 'System Design', 'Coding Challenge', 'Technical Screen', 'Full Simulation'],
        trim: true
    },
    
    // Enhanced conversation tracking
    conversationMemory: {
        type: conversationMemorySchema,
        default: () => ({
            mentionedExperiences: [],
            technicalTopics: [],
            personalTraits: [],
            backgroundHighlights: [],
            conversationFlow: []
        })
    },
    
    history: [historyItemSchema],
    
    messages: { 
        type: Array, 
        default: [],
        validate: {
            validator: function(messages) {
                return messages.length <= 50;
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
    
    warnings: {
        type: Number,
        default: 0,
        max: 3
    },
    
    currentDifficulty: { 
        type: String, 
        enum: ['easy', 'medium', 'hard'], 
        default: 'medium' 
    },
    
    // Enhanced performance tracking
    performanceMetrics: {
        averageScore: {
            type: Number,
            min: 0,
            max: 5,
            default: null
        },
        averageSentiment: {
            type: String,
            enum: ['positive', 'negative', 'neutral'],
            default: 'neutral'
        },
        engagementLevel: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium'
        },
        adaptationCount: {
            type: Number,
            default: 0
        }
    },
    
    report: { 
        type: Object,
        default: null
    },
    
    reportGeneratedAt: {
        type: Date,
        default: null
    },

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
                if (this.interviewMode === 'specific') return true;
                return stage >= 1 && stage <= 3;
            },
            message: 'Invalid stage for interview mode'
        }
    },

    endReason: {
        type: String,
        enum: ['natural_conclusion', 'user_ended', 'time_limit', 'technical_error', 'inappropriate_behavior'],
        default: null
    },
    
    lastActivity: {
        type: Date,
        default: Date.now
    },
    
    totalQuestions: {
        type: Number,
        default: 0
    },
    
    averageResponseTime: {
        type: Number,
        default: null
    },
    
    userFeedback: {
        type: userFeedbackSchema,
        default: null
    },
    
    // Enhanced metadata
    sessionMetadata: {
        userAgent: String,
        ipAddress: String,
        timezone: String,
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet'],
            default: 'desktop'
        },
        browserType: String
    }

}, { 
    timestamps: true,
    indexes: [
        { status: 1, createdAt: -1 },
        { interviewType: 1, interviewMode: 1 },
        { lastActivity: 1 },
        { role: 1, company: 1 }
    ]
});

// Enhanced pre-save middleware
sessionSchema.pre('save', function(next) {
    // Update total questions count
    this.totalQuestions = this.history.length;
    
    // Update last activity
    this.lastActivity = new Date();
    
    // Calculate performance metrics
    const completedItems = this.history.filter(item => 
        item.analysis && typeof item.analysis.score === 'number'
    );
    
    if (completedItems.length > 0) {
        // Average score calculation
        const totalScore = completedItems.reduce((sum, item) => sum + item.analysis.score, 0);
        this.performanceMetrics.averageScore = Math.round((totalScore / completedItems.length) * 10) / 10;
        
        // Average sentiment calculation
        const sentiments = completedItems
            .filter(item => item.analysis.sentiment)
            .map(item => item.analysis.sentiment);
            
        if (sentiments.length > 0) {
            const sentimentScores = {
                'positive': 1,
                'neutral': 0,
                'uncertain': -0.5,
                'negative': -1
            };
            
            const avgSentimentScore = sentiments.reduce((sum, sentiment) => 
                sum + (sentimentScores[sentiment] || 0), 0) / sentiments.length;
                
            if (avgSentimentScore > 0.3) this.performanceMetrics.averageSentiment = 'positive';
            else if (avgSentimentScore < -0.3) this.performanceMetrics.averageSentiment = 'negative';
            else this.performanceMetrics.averageSentiment = 'neutral';
        }
        
        // Calculate average response time
        const timedItems = this.history.filter(item => 
            item.timestampStart && item.timestampEnd
        );
        
        if (timedItems.length > 0) {
            const totalTime = timedItems.reduce((sum, item) => {
                return sum + (item.timestampEnd - item.timestampStart);
            }, 0);
            
            this.averageResponseTime = Math.round(totalTime / timedItems.length / 1000);
        }
        
        // Engagement level calculation
        const recentItems = this.history.slice(-5);
        const recentResponses = recentItems.filter(item => item.userAnswer && item.userAnswer.length > 20);
        const engagementRatio = recentResponses.length / Math.max(recentItems.length, 1);
        
        if (engagementRatio > 0.7) this.performanceMetrics.engagementLevel = 'high';
        else if (engagementRatio > 0.4) this.performanceMetrics.engagementLevel = 'medium';
        else this.performanceMetrics.engagementLevel = 'low';
    }
    
    // Cleanup old messages if too many
    if (this.messages && this.messages.length > 50) {
        this.messages = [
            this.messages[0], // Keep greeting
            ...this.messages.slice(-44)
        ];
    }
    
    // Clean up conversation memory to prevent bloat
    if (this.conversationMemory) {
        // Keep only last 15 mentioned experiences
        if (this.conversationMemory.mentionedExperiences.length > 15) {
            this.conversationMemory.mentionedExperiences = 
                this.conversationMemory.mentionedExperiences.slice(-15);
        }
        
        // Keep only unique technical topics (max 20)
        if (this.conversationMemory.technicalTopics.length > 20) {
            this.conversationMemory.technicalTopics = 
                [...new Set(this.conversationMemory.technicalTopics)].slice(-20);
        }
        
        // Keep only unique personal traits (max 10)
        this.conversationMemory.personalTraits = 
            [...new Set(this.conversationMemory.personalTraits)].slice(-10);
    }
    
    next();
});

// Enhanced static methods
sessionSchema.statics.findActiveSessionsOlderThan = function(hours) {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.find({
        status: 'ongoing',
        lastActivity: { $lt: cutoffTime }
    });
};

sessionSchema.statics.findHighEngagementSessions = function(days = 7) {
    const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return this.find({
        createdAt: { $gte: cutoffTime },
        'performanceMetrics.engagementLevel': 'high',
        status: 'completed'
    });
};

sessionSchema.statics.getSessionAnalytics = function(days = 30) {
    const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    return this.aggregate([
        { $match: { createdAt: { $gte: cutoffTime }, status: 'completed' } },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                avgScore: { $avg: '$performanceMetrics.averageScore' },
                avgResponseTime: { $avg: '$averageResponseTime' },
                sentimentDistribution: {
                    $push: '$performanceMetrics.averageSentiment'
                },
                engagementDistribution: {
                    $push: '$performanceMetrics.engagementLevel'
                }
            }
        }
    ]);
};

// Enhanced instance methods
sessionSchema.methods.isExpired = function(maxHours = 24) {
    const expiryTime = new Date(this.lastActivity.getTime() + (maxHours * 60 * 60 * 1000));
    return new Date() > expiryTime;
};

sessionSchema.methods.getSessionDurationMinutes = function() {
    if (this.status !== 'completed') return null;
    return Math.round((this.lastActivity - this.createdAt) / (1000 * 60));
};

sessionSchema.methods.getConversationSummary = function() {
    const summary = {
        duration: this.getSessionDurationMinutes(),
        questionsAnswered: this.history.filter(h => h.userAnswer && h.userAnswer.trim().length > 0).length,
        averageScore: this.performanceMetrics.averageScore,
        sentiment: this.performanceMetrics.averageSentiment,
        engagement: this.performanceMetrics.engagementLevel,
        technicalTopics: this.conversationMemory?.technicalTopics || [],
        personalTraits: this.conversationMemory?.personalTraits || [],
        backgroundUtilized: this.conversationMemory?.mentionedExperiences?.length > 0,
        adaptations: this.performanceMetrics.adaptationCount
    };
    
    return summary;
};

sessionSchema.methods.addConversationMemory = function(type, value, context = '') {
    if (!this.conversationMemory) {
        this.conversationMemory = {
            mentionedExperiences: [],
            technicalTopics: [],
            personalTraits: [],
            backgroundHighlights: [],
            conversationFlow: []
        };
    }
    
    const experience = {
        type,
        value: Array.isArray(value) ? value : [value],
        context: context.substring(0, 100),
        mentionedAt: new Date()
    };
    
    this.conversationMemory.mentionedExperiences.push(experience);
    return this.save();
};

sessionSchema.methods.addTechnicalTopic = function(topic) {
    if (!this.conversationMemory) {
        this.conversationMemory = { technicalTopics: [] };
    }
    
    if (!this.conversationMemory.technicalTopics.includes(topic.toLowerCase())) {
        this.conversationMemory.technicalTopics.push(topic.toLowerCase());
    }
    
    return this.save();
};

sessionSchema.methods.updateEngagement = function(stage, topic, level) {
    if (!this.conversationMemory?.conversationFlow) {
        if (!this.conversationMemory) this.conversationMemory = {};
        this.conversationMemory.conversationFlow = [];
    }
    
    this.conversationMemory.conversationFlow.push({
        stage,
        topic,
        engagement: level,
        timestamp: new Date()
    });
    
    // Update overall engagement metric
    const recentFlow = this.conversationMemory.conversationFlow.slice(-5);
    const highEngagement = recentFlow.filter(f => f.engagement === 'high').length;
    
    if (highEngagement >= 3) {
        this.performanceMetrics.engagementLevel = 'high';
    } else if (highEngagement >= 1) {
        this.performanceMetrics.engagementLevel = 'medium';
    }
    
    return this.save();
};

sessionSchema.methods.shouldAdaptDifficulty = function() {
    const recentScores = this.history.slice(-3)
        .filter(h => h.analysis?.score)
        .map(h => h.analysis.score);
    
    if (recentScores.length < 2) return null;
    
    const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const lastSentiment = this.history[this.history.length - 1]?.analysis?.sentiment;
    
    // Suggest difficulty increase
    if (avgScore >= 4.2 && lastSentiment === 'positive') {
        return { direction: 'increase', reason: 'high_performance_positive_sentiment' };
    }
    
    // Suggest difficulty decrease
    if (avgScore < 2.3 && (lastSentiment === 'negative' || lastSentiment === 'uncertain')) {
        return { direction: 'decrease', reason: 'low_performance_negative_sentiment' };
    }
    
    return null;
};

sessionSchema.methods.getPersonalizedInsights = function() {
    const insights = {
        communicationStyle: 'balanced',
        technicalStrength: 'general',
        learningIndicators: [],
        engagementPatterns: [],
        adaptationHistory: []
    };
    
    if (this.conversationMemory) {
        // Analyze communication style
        const traits = this.conversationMemory.personalTraits;
        if (traits.includes('confident') && traits.includes('analytical')) {
            insights.communicationStyle = 'direct_analytical';
        } else if (traits.includes('thoughtful') && traits.includes('collaborative')) {
            insights.communicationStyle = 'reflective_collaborative';
        } else if (traits.includes('needs_encouragement')) {
            insights.communicationStyle = 'supportive_guidance_needed';
        }
        
        // Determine technical strength
        const techTopics = this.conversationMemory.technicalTopics;
        if (techTopics.length > 5) {
            insights.technicalStrength = 'broad_knowledge';
        } else if (techTopics.some(topic => 
            ['react', 'node', 'python', 'aws'].includes(topic))) {
            insights.technicalStrength = 'modern_stack';
        }
        
        // Learning indicators
        if (traits.includes('learned')) {
            insights.learningIndicators.push('growth_mindset');
        }
        if (traits.includes('challenged')) {
            insights.learningIndicators.push('resilience');
        }
    }
    
    return insights;
};

// Add indexes for better performance
historyItemSchema.index({ timestampStart: 1 });
historyItemSchema.index({ stage: 1 });
historyItemSchema.index({ 'analysis.sentiment': 1 });
historyItemSchema.index({ 'analysis.score': 1 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);                                