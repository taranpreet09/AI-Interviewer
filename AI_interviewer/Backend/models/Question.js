const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: { 
        type: String, 
        required: [true, 'Question text is required'],
        unique: true,
        trim: true,
        minlength: [10, 'Question text must be at least 10 characters'],
        maxlength: [2000, 'Question text cannot exceed 2000 characters']
    },
    
    category: { 
        type: String, 
        required: [true, 'Question category is required'],
        enum: {
            values: ['behavioral', 'theory', 'coding'],
            message: 'Category must be behavioral, theory, or coding'
        },
        lowercase: true,
        trim: true
    },
    
    difficulty: { 
        type: String, 
        required: [true, 'Question difficulty is required'],
        enum: {
            values: ['easy', 'medium', 'hard'],
            message: 'Difficulty must be easy, medium, or hard'
        },
        lowercase: true,
        default: 'medium'
    },
    
    source: { 
        type: String, 
        required: [true, 'Question source is required'],
        enum: {
            values: ['seed', 'ai', 'manual'],
            message: 'Source must be seed, ai, or manual'
        },
        default: 'ai'
    },
    
    tags: {
        type: [String],
        default: [],
        validate: {
            validator: function(tags) {
                return tags.length <= 10; // Max 10 tags
            },
            message: 'Cannot have more than 10 tags'
        }
    },
    
    // Language ID for coding questions (Judge0 API compatibility)
    language_id: { 
        type: Number, 
        default: null,
        validate: {
            validator: function(languageId) {
                // If category is coding, language_id is required
                if (this.category === 'coding') {
                    return languageId !== null && languageId > 0;
                }
                // For non-coding questions, language_id should be null
                return languageId === null;
            },
            message: 'Coding questions require a valid language_id, non-coding questions should not have one'
        }
    },
    
    // Ideal answer for theory questions
    idealAnswer: { 
        type: String, 
        default: null,
        maxlength: [3000, 'Ideal answer cannot exceed 3000 characters'],
        validate: {
            validator: function(idealAnswer) {
                // Theory questions should ideally have an ideal answer
                if (this.category === 'theory' && (!idealAnswer || idealAnswer.trim().length < 20)) {
                    return false;
                }
                return true;
            },
            message: 'Theory questions should have a detailed ideal answer (minimum 20 characters)'
        }
    },
    
    // Metadata for better question management
    usageCount: {
        type: Number,
        default: 0,
        min: 0
    },
    
    averageScore: {
        type: Number,
        default: null,
        min: 0,
        max: 5
    },
    
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    createdBy: {
        type: String,
        default: 'system',
        trim: true
    },
    
    lastUsed: {
        type: Date,
        default: null
    },
    
    // For coding questions - expected time/space complexity
    expectedComplexity: {
        time: {
            type: String,
            default: null,
            validate: {
                validator: function(complexity) {
                    if (!complexity) return true;
                    // Basic validation for Big O notation
                    return /^O\([^)]+\)$/i.test(complexity);
                },
                message: 'Time complexity must be in Big O notation (e.g., O(n), O(log n))'
            }
        },
        space: {
            type: String,
            default: null,
            validate: {
                validator: function(complexity) {
                    if (!complexity) return true;
                    return /^O\([^)]+\)$/i.test(complexity);
                },
                message: 'Space complexity must be in Big O notation (e.g., O(1), O(n))'
            }
        }
    },
    
    // Question quality metrics
    qualityScore: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    
    reviewStatus: {
        type: String,
        enum: ['pending', 'approved', 'needs_revision', 'rejected'],
        default: 'pending'
    }
    
}, { 
    timestamps: true,
    indexes: [
        { category: 1, difficulty: 1, isActive: 1 },
        { tags: 1 },
        { usageCount: -1 },
        { lastUsed: -1 }
    ]
});

// Compound index for efficient question selection
questionSchema.index({ category: 1, difficulty: 1, isActive: 1, usageCount: 1 });

// Text index for search functionality
questionSchema.index({ text: 'text', tags: 'text' });

// Pre-save middleware to normalize and validate data
questionSchema.pre('save', function(next) {
    // Normalize tags
    if (this.tags && this.tags.length > 0) {
        this.tags = this.tags
            .map(tag => tag.toLowerCase().trim())
            .filter(tag => tag.length > 0)
            .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
    }
    
    // Auto-generate tags based on content for AI-generated questions
    if (this.source === 'ai' && this.tags.length === 0) {
        const autoTags = [];
        
        // Add category as tag
        autoTags.push(this.category);
        
        // Add difficulty as tag
        autoTags.push(this.difficulty);
        
        // Extract keywords from question text
        const keywords = this.text.toLowerCase().match(/\b(javascript|python|react|node|database|sql|algorithm|data structure|system design|scalability)\b/g);
        if (keywords) {
            autoTags.push(...keywords.slice(0, 3)); // Max 3 keywords
        }
        
        this.tags = [...new Set(autoTags)]; // Remove duplicates
    }
    
    next();
});

// Static methods for common operations
questionSchema.statics.findByCategory = function(category, difficulty = null, limit = 10) {
    const query = { category, isActive: true };
    if (difficulty) query.difficulty = difficulty;
    
    return this.find(query)
        .sort({ usageCount: 1, lastUsed: 1 }) // Prefer less used questions
        .limit(limit);
};

questionSchema.statics.findUnusedQuestions = function(excludeIds = [], category = null) {
    const query = { 
        _id: { $nin: excludeIds },
        isActive: true,
        usageCount: { $lt: 5 } // Questions used less than 5 times
    };
    
    if (category) query.category = category;
    
    return this.find(query).sort({ usageCount: 1 });
};

questionSchema.statics.getRandomQuestion = function(category, difficulty, excludeIds = []) {
    const matchStage = {
        category,
        difficulty,
        isActive: true,
        _id: { $nin: excludeIds }
    };
    
    return this.aggregate([
        { $match: matchStage },
        { $sample: { size: 1 } }
    ]);
};

// Instance methods
questionSchema.methods.incrementUsage = function() {
    this.usageCount += 1;
    this.lastUsed = new Date();
    return this.save();
};

questionSchema.methods.updateAverageScore = function(newScore) {
    if (this.averageScore === null) {
        this.averageScore = newScore;
    } else {
        // Simple moving average approximation
        this.averageScore = (this.averageScore * 0.8) + (newScore * 0.2);
        this.averageScore = Math.round(this.averageScore * 10) / 10; // Round to 1 decimal
    }
    return this.save();
};

questionSchema.methods.isOverused = function(threshold = 20) {
    return this.usageCount > threshold;
};

// Virtual for displaying question preview
questionSchema.virtual('preview').get(function() {
    return this.text.length > 100 ? 
        this.text.substring(0, 100) + '...' : 
        this.text;
});

// Export the model
// At the end of models/Question.js
module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);