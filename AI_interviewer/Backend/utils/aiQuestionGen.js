const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced question generation that considers candidate context and conversation history
async function generateAiQuestion(context) {
    const { 
        role, 
        company, 
        type, 
        interviewType, 
        difficulty, 
        history, 
        candidateContext, 
        conversationMemory,
        currentStage,
        lastAnswerAnalysis,
        interviewMode
    } = context;
    
    // Build context-aware prompt
    const prompt = buildContextAwarePrompt({
        role,
        company,
        type,
        interviewType,
        difficulty,
        history,
        candidateContext,
        conversationMemory,
        currentStage,
        lastAnswerAnalysis,
        interviewMode
    });

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.7, // Allow some creativity while maintaining relevance
                maxOutputTokens: 400,
                responseMimeType: "application/json"
            }
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let content = response.text();
        
        // Parse and validate the response
        const parsedResponse = JSON.parse(content);
        
        if (parsedResponse.text && parsedResponse.category && parsedResponse.difficulty) {
            // Add contextual metadata
            parsedResponse.contextualRelevance = {
                referencesBackground: !!candidateContext,
                buildsOnPrevious: history.length > 0,
                adaptedDifficulty: difficulty !== 'medium',
                personalizedElements: extractPersonalizationElements(parsedResponse.text, conversationMemory)
            };
            
            return parsedResponse;
        } else {
            throw new Error("Invalid JSON structure from AI");
        }
        
    } catch (error) {
        console.error("AI Question Generation Failed:", error.message);
        
        // Fallback to context-aware static question
        return generateFallbackQuestion(context);
    }
}

function buildContextAwarePrompt({
    role, 
    company, 
    type, 
    interviewType, 
    difficulty, 
    history, 
    candidateContext,
    conversationMemory,
    currentStage,
    lastAnswerAnalysis,
    interviewMode
}) {
    let prompt = `You are an expert interviewer creating personalized questions for a ${role} candidate.

<interview_context>
Company: ${company || 'Tech Company'}
Interview Type: ${interviewType}
Interview Mode: ${interviewMode}
Current Stage: ${currentStage || 1}
Target Difficulty: ${difficulty}
Question Category: ${type}
</interview_context>

<candidate_profile>`;

    // Add candidate background context
    if (candidateContext) {
        prompt += `
Background: ${candidateContext}
`;
    }
    
    // Add conversation memory insights
    if (conversationMemory) {
        if (conversationMemory.technicalTopics?.length > 0) {
            prompt += `
Technical Topics Discussed: ${conversationMemory.technicalTopics.slice(0, 5).join(', ')}
`;
        }
        
        if (conversationMemory.personalTraits?.length > 0) {
            prompt += `
Observed Traits: ${conversationMemory.personalTraits.join(', ')}
`;
        }
        
        if (conversationMemory.mentionedExperiences?.length > 0) {
            const recentExp = conversationMemory.mentionedExperiences.slice(-3);
            prompt += `
Recent Mentions: ${recentExp.map(exp => `${exp.type} - ${exp.value.join(', ')}`).join('; ')}
`;
        }
    }
    
    prompt += `</candidate_profile>

<conversation_flow>`;
    
    // Add recent conversation context
    if (history.length > 0) {
        const recentQuestions = history.slice(-3).map((item, index) => {
            return `Q${history.length - 3 + index + 1}: ${item.question?.text || 'Previous question'}`;
        }).join('\n');
        
        prompt += `
Previous Questions:
${recentQuestions}
`;
        
        // Add sentiment context
        if (lastAnswerAnalysis) {
            prompt += `
Last Answer Context: ${lastAnswerAnalysis.sentiment} sentiment, emotions: ${lastAnswerAnalysis.emotions?.join(', ') || 'neutral'}
`;
        }
    }
    
    prompt += `</conversation_flow>

<question_requirements>
1. **Personalization**: Reference their background, mentioned experiences, or previous answers when relevant
2. **Natural Flow**: Build on the conversation naturally, don't ask disconnected questions
3. **Appropriate Difficulty**: ${getDifficultyGuidance(difficulty, lastAnswerAnalysis)}
4. **Category**: Must be "${type}" category
5. **Stage Appropriate**: ${getStageGuidance(currentStage, interviewMode)}
</question_requirements>

<personalization_techniques>
- If they mentioned specific companies/projects, reference them: "You mentioned working at [Company]..."
- If they showed expertise in an area, dive deeper: "Given your experience with [Technology]..."
- If they seemed uncertain, provide context: "Let's explore something that might align with your [Background]..."
- If they were confident, challenge them: "Building on your strong answer about [Topic]..."
- Connect to their stated goals or interests from their background
</personalization_techniques>

Generate ONE interview question that feels natural, personalized, and conversational.

Respond with JSON only:
{
  "text": "Your personalized, conversational question",
  "category": "${type}",
  "difficulty": "${difficulty}",
  "personalizationNote": "Brief note on how this question is personalized"
}`;

    return prompt;
}

function getDifficultyGuidance(difficulty, lastAnswerAnalysis) {
    const guidance = {
        'easy': 'Create an accessible question that builds confidence',
        'medium': 'Ask a standard question appropriate for the role level', 
        'hard': 'Design a challenging question that tests deeper knowledge'
    };
    
    let baseGuidance = guidance[difficulty] || guidance['medium'];
    
    // Adjust based on sentiment
    if (lastAnswerAnalysis) {
        if (lastAnswerAnalysis.emotions?.includes('nervous') && difficulty === 'hard') {
            baseGuidance += '. Be encouraging in your phrasing.';
        } else if (lastAnswerAnalysis.sentiment === 'positive' && difficulty === 'easy') {
            baseGuidance += '. They seem confident, so you can be more direct.';
        }
    }
    
    return baseGuidance;
}

function getStageGuidance(stage, interviewMode) {
    if (interviewMode !== 'full') {
        return 'Focus on the specific interview type without stage constraints';
    }
    
    const stageGuidance = {
        1: 'Focus on getting to know them, their background, and basic fit',
        2: 'Deep dive into technical knowledge and problem-solving abilities', 
        3: 'Explore leadership, culture fit, and behavioral scenarios'
    };
    
    return stageGuidance[stage] || stageGuidance[1];
}

function extractPersonalizationElements(questionText, conversationMemory) {
    const elements = [];
    
    if (!conversationMemory) return elements;
    
    // Check if question references technical topics
    const mentionedTech = conversationMemory.technicalTopics?.filter(topic => 
        questionText.toLowerCase().includes(topic.toLowerCase())
    ) || [];
    
    if (mentionedTech.length > 0) {
        elements.push(`references_technical_background: ${mentionedTech.join(', ')}`);
    }
    
    // Check if question references previous experiences
    const experiences = conversationMemory.mentionedExperiences || [];
    const referencedExperiences = experiences.filter(exp => 
        exp.value.some(val => questionText.toLowerCase().includes(val.toLowerCase()))
    );
    
    if (referencedExperiences.length > 0) {
        elements.push(`builds_on_experience: ${referencedExperiences[0].type}`);
    }
    
    return elements;
}

// Enhanced fallback question generation
function generateFallbackQuestion(context) {
    const { 
        type, 
        difficulty, 
        candidateContext, 
        conversationMemory, 
        role,
        history
    } = context;
    
    // Context-aware fallback questions
    const fallbackQuestions = {
        behavioral: {
            easy: [
                candidateContext ? 
                    `Given your background, can you tell me about a recent project or experience you're particularly proud of?` :
                    `Tell me about a recent project or accomplishment that you're proud of.`,
                    
                conversationMemory?.personalTraits?.includes('collaborative') ?
                    `You seem to work well with others. Can you describe a time when teamwork was crucial to your success?` :
                    `Describe a time when you had to work closely with a team to achieve a goal.`
            ],
            medium: [
                conversationMemory?.technicalTopics?.length > 0 ?
                    `Thinking about your experience with ${conversationMemory.technicalTopics[0]}, tell me about a challenging technical problem you solved.` :
                    `Tell me about a time you faced a significant challenge at work and how you handled it.`,
                    
                candidateContext?.toLowerCase().includes('lead') ?
                    `Given your leadership experience, describe a time you had to make a difficult decision with limited information.` :
                    `Describe a situation where you had to make an important decision with incomplete information.`
            ],
            hard: [
                `Tell me about a time you failed at something important. What did you learn and how did you apply that learning?`,
                conversationMemory?.mentionedExperiences?.length > 0 ?
                    `Reflecting on your experience at ${conversationMemory.mentionedExperiences[0]?.value[0] || 'your previous role'}, describe the most complex problem you solved there.` :
                    `Describe the most complex problem you've solved in your career and your approach to solving it.`
            ]
        },
        
        theory: {
            easy: [
                conversationMemory?.technicalTopics?.includes('javascript') ?
                    `Since you've worked with JavaScript, can you explain the difference between let, const, and var?` :
                    `Can you explain what REST APIs are and why they're useful?`
            ],
            medium: [
                role.toLowerCase().includes('senior') ?
                    `How would you explain microservices architecture to a junior developer?` :
                    `What's the difference between SQL and NoSQL databases, and when would you use each?`
            ],
            hard: [
                `Explain how you would design a caching strategy for a high-traffic web application.`,
                conversationMemory?.technicalTopics?.includes('react') ?
                    `How does React's reconciliation algorithm work, and how can you optimize performance?` :
                    `Explain the CAP theorem and its implications for distributed systems design.`
            ]
        },
        
        coding: {
            easy: [
                `Write a function that finds the largest number in an array.`,
                candidateContext?.toLowerCase().includes('beginner') ?
                    `Create a simple function that reverses a string.` :
                    `Write a function that checks if a string is a palindrome.`
            ],
            medium: [
                conversationMemory?.technicalTopics?.includes('algorithms') ?
                    `Implement a binary search algorithm.` :
                    `Write a function that finds the first duplicate in an array.`,
                    
                `Given two sorted arrays, write a function to merge them into one sorted array.`
            ],
            hard: [
                `Design and implement a LRU (Least Recently Used) cache.`,
                role.toLowerCase().includes('senior') ?
                    `Implement a thread-safe singleton pattern and explain your design choices.` :
                    `Write a function that finds the longest palindromic substring in a given string.`
            ]
        }
    };
    
    // Select appropriate fallback question
    const categoryQuestions = fallbackQuestions[type] || fallbackQuestions.behavioral;
    const difficultyQuestions = categoryQuestions[difficulty] || categoryQuestions.medium;
    const questionText = difficultyQuestions[0] || `Tell me about your experience with ${role} responsibilities.`;
    
    return {
        text: questionText,
        category: type,
        difficulty: difficulty,
        source: 'contextual_fallback',
        personalizationNote: candidateContext ? 'Adapted based on candidate background' : 'Standard fallback question',
        contextualRelevance: {
            referencesBackground: !!candidateContext,
            buildsOnPrevious: history.length > 0,
            adaptedDifficulty: difficulty !== 'medium',
            personalizedElements: []
        }
    };
}

// Function to validate question quality
function validateQuestionQuality(question, context) {
    const issues = [];
    
    // Check for personalization opportunities missed
    if (context.candidateContext && !question.text.toLowerCase().includes('your')) {
        issues.push('Could be more personalized');
    }
    
    // Check for repetitive patterns
    if (context.history.length > 0) {
        const recentQuestions = context.history.slice(-3).map(h => h.question?.text || '');
        const similarStart = recentQuestions.some(q => 
            q.substring(0, 20).toLowerCase() === question.text.substring(0, 20).toLowerCase()
        );
        
        if (similarStart) {
            issues.push('Similar to recent question');
        }
    }
    
    // Check appropriate length
    if (question.text.length < 20) {
        issues.push('Question too short');
    } else if (question.text.length > 200) {
        issues.push('Question too long');
    }
    
    return {
        isValid: issues.length === 0,
        issues: issues,
        score: Math.max(1, 5 - issues.length) // 1-5 quality score
    };
}

module.exports = { 
    generateAiQuestion, 
    validateQuestionQuality,
    generateFallbackQuestion,
    extractPersonalizationElements
};