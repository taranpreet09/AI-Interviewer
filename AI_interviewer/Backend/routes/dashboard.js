const express = require('express');
const router = express.Router();
const Session = require('../models/session');

router.get('/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId).populate('history.question');
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        if (!session.history || session.history.length === 0) {
            return res.status(404).json({ 
                message: 'No analytics data available for this session.',
                suggestion: 'Complete some interview questions first.'
            });
        }

        // Initialize data structures
        const confidenceData = [];
        const timeData = [];
        const categoryBreakdown = { behavioral: 0, theory: 0, coding: 0 };
        let totalScore = 0;
        let scoredQuestions = 0;

        // Process each history item
        session.history.forEach((item, index) => {
            // Ensure we have the necessary data
            if (!item.question) {
                console.warn(`History item ${index} missing question reference`);
                return;
            }

            const questionNumber = index + 1;
            const category = item.question.category || 'unknown';
            
            // Count questions by category
            if (categoryBreakdown.hasOwnProperty(category)) {
                categoryBreakdown[category]++;
            }

            // Score/confidence data (corrected property access)
            if (item.analysis && typeof item.analysis.score === 'number') {
                const score = item.analysis.score;
                confidenceData.push({
                    question: `Q${questionNumber}`,
                    category: category,
                    score: Math.round(score * 10) / 10, // Round to 1 decimal
                });
                
                totalScore += score;
                scoredQuestions++;
            }

            // Time analysis
            if (item.timestampStart && item.timestampEnd) {
                const timeTaken = Math.round((new Date(item.timestampEnd) - new Date(item.timestampStart)) / 1000); 
                timeData.push({
                    question: `Q${questionNumber} (${category})`,
                    time: timeTaken,
                    category: category
                });
            }
        });

        // Calculate performance metrics
        const averageScore = scoredQuestions > 0 ? Math.round((totalScore / scoredQuestions) * 10) / 10 : 0;
        const averageTime = timeData.length > 0 ? 
            Math.round(timeData.reduce((sum, item) => sum + item.time, 0) / timeData.length) : 0;

        // Performance classification
        let performanceLevel = 'Developing';
        if (averageScore >= 4.0) performanceLevel = 'Excellent';
        else if (averageScore >= 3.5) performanceLevel = 'Good';
        else if (averageScore >= 2.5) performanceLevel = 'Fair';

        // Time efficiency analysis
        let timeEfficiency = 'Normal';
        if (averageTime < 30) timeEfficiency = 'Fast';
        else if (averageTime > 120) timeEfficiency = 'Deliberate';

        // Category performance breakdown
        const categoryPerformance = [];
        Object.entries(categoryBreakdown).forEach(([category, count]) => {
            if (count > 0) {
                const categoryScores = confidenceData
                    .filter(item => item.category === category)
                    .map(item => item.score);
                
                const avgCategoryScore = categoryScores.length > 0 ?
                    Math.round((categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length) * 10) / 10 : 0;
                
                categoryPerformance.push({
                    name: category.charAt(0).toUpperCase() + category.slice(1),
                    count: count,
                    averageScore: avgCategoryScore,
                    performance: avgCategoryScore >= 3.5 ? 'Strong' : avgCategoryScore >= 2.5 ? 'Good' : 'Needs Work'
                });
            }
        });

        // Response consistency analysis
        const scoreVariance = confidenceData.length > 1 ? 
            calculateVariance(confidenceData.map(d => d.score)) : 0;
        
        const consistency = scoreVariance < 1 ? 'Consistent' : 
                          scoreVariance < 2 ? 'Moderate' : 'Variable';

        // Prepare response data
        const analyticsData = {
            // Original data for charts
            confidenceData,
            timeData,
            
            // Enhanced category breakdown
            categoryBreakdown: Object.entries(categoryBreakdown).map(([name, value]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                value
            })),
            
            // Performance summary
            summary: {
                totalQuestions: session.history.length,
                completedQuestions: confidenceData.length,
                averageScore,
                averageTimeSeconds: averageTime,
                performanceLevel,
                timeEfficiency,
                consistency
            },
            
            // Category-wise performance
            categoryPerformance,
            
            // Session metadata
            sessionInfo: {
                role: session.role,
                company: session.company,
                interviewType: session.interviewType,
                interviewMode: session.interviewMode,
                currentStage: session.currentStage,
                status: session.status,
                duration: session.getSessionDurationMinutes ? session.getSessionDurationMinutes() : null
            }
        };

        res.json(analyticsData);

    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ 
            message: 'Server error fetching dashboard data', 
            error: error.message,
            timestamp: new Date()
        });
    }
});

// Utility function to calculate variance
function calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

// Additional endpoint for real-time session progress
router.get('/:sessionId/progress', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId);
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        const progress = {
            currentStage: session.currentStage,
            totalQuestions: session.history.length,
            status: session.status,
            lastActivity: session.lastActivity,
            estimatedTimeRemaining: estimateTimeRemaining(session)
        };

        res.json(progress);
    } catch (error) {
        console.error('Progress tracking error:', error);
        res.status(500).json({ message: 'Error tracking session progress' });
    }
});

function estimateTimeRemaining(session) {
    if (session.status === 'completed') return 0;
    
    // Rough estimation based on interview mode and current progress
    const baseTime = session.interviewMode === 'full' ? 45 : 20; // minutes
    const progressRatio = session.currentStage / 3;
    
    return Math.max(0, Math.round(baseTime * (1 - progressRatio)));
}

module.exports = router;