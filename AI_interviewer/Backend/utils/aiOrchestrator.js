const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function analyzeAnswerHeuristic(answer, question) {
    if (!answer || !question) {
        return { 
            isWeak: true, 
            reasons: ["No answer provided."], 
            isRude: false,
            emotions: [],
            sentiment: "neutral"
        };
    }

    const wordCount = answer.trim().split(/\s+/).length;
    let reasons = [];
    let isWeak = false;

    // --- Enhanced sentiment analysis ---
    const sentiment = analyzeSentiment(answer);
    
    // --- Detect rudeness ---
    const rudePatterns = [
        /\bf+u+c+k+\b/i,
        /\bshit+\b/i,
        /\bdamn+\b/i,
        /\bidiot(ic)?\b/i,
        /\bmoron\b/i,
        /\bbullshit\b/i
    ];
    const isRude = rudePatterns.some(pattern => pattern.test(answer));
    if (isRude) {
        return { 
            isWeak: true, 
            isRude: true, 
            reasons: ["Inappropriate or unprofessional language detected."],
            emotions: ["frustrated","angry"],
            sentiment: "negative"
        };
    }

    // --- Enhanced emotional tone detection ---
    const emotions = detectEmotions(answer);

    // --- Behavioral question check (STAR method) ---
    if (question.category === 'behavioral') {
        let starCount = 0;
        if (/(situation|context|project|challenge|scenario|when)/i.test(answer)) starCount++;
        if (/(task|goal|objective|responsibility|role|needed to)/i.test(answer)) starCount++;
        if (/(action|i did|we did|i implemented|steps?|approach|decided)/i.test(answer)) starCount++;
        if (/(result|outcome|impact|achieved|success|learned|improved)/i.test(answer)) starCount++;

        if (wordCount < 30) {
            isWeak = true;
            reasons.push("Answer could use more detail to showcase your experience.");
        }
        if (starCount < 2) {
            isWeak = true;
            reasons.push("Answer would benefit from more structure (situation, action, result).");
        }
    } else if (question.category === 'theory') {
        if (wordCount < 15) {
            isWeak = true;
            reasons.push("Answer seems brief for a technical concept.");
        }
    } else if (question.category === 'coding') {
        if (wordCount < 20 && !answer.includes('function') && !answer.includes('def')) {
            isWeak = true;
            reasons.push("Could you provide a code solution or more detailed approach?");
        }
    }

    return { 
        isWeak, 
        reasons, 
        isRude: false, 
        emotions,
        sentiment
    };
}

function analyzeSentiment(text) {
    const positiveWords = /\b(excited|happy|proud|confident|enjoyed|love|great|excellent|amazing|wonderful|successful|achieved)\b/i;
    const negativeWords = /\b(difficult|hard|challenging|frustrated|confused|worried|nervous|struggled|failed|disappointed)\b/i;
    const uncertainWords = /\b(maybe|perhaps|think|probably|might|unsure|not sure|guess)\b/i;
    
    if (positiveWords.test(text)) return "positive";
    if (negativeWords.test(text)) return "negative";
    if (uncertainWords.test(text)) return "uncertain";
    return "neutral";
}

function detectEmotions(answer) {
    const emotions = [];
    
    // Nervous indicators
    if (/\b(nervous|anxious|worried|unsure|uncertain)\b/i.test(answer) || /umm+|uhh+|well\.\.\.|hmm/i.test(answer)) {
        emotions.push("nervous");
    }
    
    // Confidence indicators  
    if (/\b(confident|sure|definitely|absolutely|certain|know for sure)\b/i.test(answer)) {
        emotions.push("confident");
    }
    
    // Excitement indicators
    if (/\b(excited|thrilled|love|passion|amazing|awesome)\b/i.test(answer)) {
        emotions.push("excited");
    }
    
    // Frustration indicators
    if (/\b(frustrated|annoyed|confused|this is hard|don't get it|stuck)\b/i.test(answer)) {
        emotions.push("frustrated");
    }
    
    // Thoughtful indicators
    if (/\b(interesting|think about|consider|reflect|analyze|approach)\b/i.test(answer)) {
        emotions.push("thoughtful");
    }
    
    // Apologetic indicators
    if (/\b(sorry|apologize|my bad|excuse me)\b/i.test(answer)) {
        emotions.push("apologetic");
    }
    
    return emotions;
}

function detectAnswerType(answer) {
    if (!answer || answer.trim() === "" || answer.toLowerCase().trim() === "no answer") {
        return "empty";
    }

    const lowerAnswer = answer.toLowerCase().trim();
    
    if (lowerAnswer.includes("i don't know") || lowerAnswer.includes("not sure") || lowerAnswer.includes("no idea")) {
        return "dont_know";
    }
    if (lowerAnswer.length < 20) {
        return "too_short";
    }
    if (lowerAnswer.includes("umm") || lowerAnswer.includes("uh") || lowerAnswer.includes("well...")) {
        return "uncertain";
    }
    if (answer.split(' ').length > 200) {
        return "too_long";
    }
    
    return "normal";
}

function buildPersonalizedContext(session, lastAnswerAnalysis) {
    const context = {
        candidateBackground: session.candidateContext || null,
        role: session.role,
        company: session.company,
        interviewHistory: [],
        personalityTraits: [],
        technicalLevel: "intermediate"
    };

    // Analyze interview history to understand candidate better
    if (session.history && session.history.length > 0) {
        const recentAnswers = session.history.slice(-3).filter(h => h.userAnswer);
        
        // Determine technical level from previous answers
        const scores = recentAnswers
            .filter(h => h.analysis && typeof h.analysis.score === 'number')
            .map(h => h.analysis.score);
            
        if (scores.length > 0) {
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avgScore >= 4.0) context.technicalLevel = "advanced";
            else if (avgScore <= 2.5) context.technicalLevel = "junior";
        }

        // Extract personality traits from emotional patterns
        const allEmotions = recentAnswers
            .map(h => h.analysis?.emotions || [])
            .flat();
            
        if (allEmotions.filter(e => e === "confident").length >= 2) {
            context.personalityTraits.push("confident");
        }
        if (allEmotions.filter(e => e === "nervous").length >= 2) {
            context.personalityTraits.push("needs_encouragement");
        }
        if (allEmotions.filter(e => e === "thoughtful").length >= 2) {
            context.personalityTraits.push("analytical");
        }
    }

    return context;
}

function buildInterviewerPrompt(session, context) {
    const { role, recentHistory, interviewMode, interviewType, currentStage, transitionText, lastAnswerAnalysis } = context;
    
    const personalizedContext = buildPersonalizedContext(session, lastAnswerAnalysis);
    const lastMessage = session.messages[session.messages.length - 1];
    const answerType = lastMessage ? detectAnswerType(lastMessage.content) : "normal";
    const isRude = lastAnswerAnalysis?.isRude || false;
    const emotions = lastAnswerAnalysis?.emotions || [];
    const sentiment = lastAnswerAnalysis?.sentiment || "neutral";

    // Handle rude answers
    if (isRude) {
        session.warnings = (session.warnings || 0) + 1;
        if (session.warnings > 1) {
            return buildEndInterviewPrompt("unprofessional_behavior");
        } else {
            return buildWarningPrompt();
        }
    }

    // Build context-aware personality instructions
    let personalityGuidance = buildPersonalityGuidance(personalizedContext, emotions, sentiment);
    
    // Stage-specific mission and tone
    const { missionBriefing, stagePersonality } = getStageGuidance(interviewMode, currentStage, interviewType);
    
    // Response context based on answer analysis
    const responseContext = buildResponseContext(answerType, sentiment, emotions);

    const systemPrompt = `You are Alex, a warm and experienced ${role} interviewer with excellent emotional intelligence.

<candidate_profile>
Background: ${personalizedContext.candidateBackground || 'Getting to know them through our conversation'}
Technical Level: ${personalizedContext.technicalLevel}
Personality Traits: ${personalizedContext.personalityTraits.join(', ') || 'Still assessing'}
Role: ${role} at ${session.company}
</candidate_profile>

<conversation_context>
Recent conversation flow:
${recentHistory}

Current emotional state: ${sentiment} (emotions: ${emotions.join(', ') || 'neutral'})
Answer quality: ${answerType}
</conversation_context>

**YOUR PERSONALITY**: You're genuinely interested in people and their stories. You:
- Remember details from their background and reference them naturally
- Show authentic reactions to their answers ("That's fascinating!" or "I can relate to that")  
- Use conversational fillers and natural language ("So...", "That reminds me...", "Actually...")
- Ask follow-up questions that show you're listening
- Share brief, relevant insights when appropriate
${personalityGuidance}

**MISSION**: ${missionBriefing}
**STAGE PERSONALITY**: ${stagePersonality}
**RESPONSE GUIDANCE**: ${responseContext}

**NATURAL CONVERSATION RULES**:
1. Always acknowledge their previous answer first ("That sounds like quite a challenge!" / "I love that approach!")
2. ${personalizedContext.candidateBackground ? 'Reference their background naturally when relevant' : 'Ask about their background when it flows naturally'}
3. Use transition phrases: "Building on that...", "That makes me curious about...", "Speaking of [topic]..."
4. Show personality: use "Actually", "You know what", "That's interesting because..."
5. If they seem nervous, be extra encouraging. If confident, challenge them more.
6. Ask questions that connect to their specific experience and background

**NEXT ACTION**: ${transitionText || 'Continue the natural conversation flow'}

Remember: You're having a conversation with a real person, not conducting a robotic interview. Be genuinely curious about their story and experience.

Respond ONLY with JSON:
{"action": "CONTINUE" or "END_INTERVIEW", "dialogue": "Your warm, conversational response with natural acknowledgment + question", "category": "behavioral/theory/coding", "difficulty": "easy/medium/hard"}`;

    return systemPrompt;
}

function buildPersonalityGuidance(context, emotions, sentiment) {
    let guidance = "";
    
    if (emotions.includes("nervous")) {
        guidance += "- Be extra warm and encouraging. Use phrases like 'No pressure at all' and 'You're doing great'\n";
    }
    
    if (emotions.includes("confident")) {
        guidance += "- They seem confident, so you can ask more challenging follow-ups and dig deeper\n";
    }
    
    if (emotions.includes("frustrated")) {
        guidance += "- They might be struggling. Offer gentle guidance and break things down\n";
    }
    
    if (context.personalityTraits.includes("analytical")) {
        guidance += "- They think deeply. Give them time and ask 'what's your thought process?'\n";
    }
    
    if (sentiment === "positive") {
        guidance += "- Match their positive energy! Be enthusiastic about their experiences\n";
    }
    
    return guidance || "- Maintain a warm, professional but friendly tone\n";
}

function getStageGuidance(interviewMode, currentStage, interviewType) {
    if (interviewMode === 'full') {
        switch (currentStage) {
            case 1:
                return {
                    missionBriefing: "Stage 1: Getting to know them personally and professionally. Build rapport and assess communication skills.",
                    stagePersonality: "Be welcoming and curious about their journey. Ask about their background, motivations, and experiences."
                };
            case 2:
                return {
                    missionBriefing: "Stage 2: Technical deep-dive. Test their knowledge and problem-solving abilities.",
                    stagePersonality: "Be intellectually curious. Challenge them while staying supportive. Ask 'how' and 'why' questions."
                };
            case 3:
                return {
                    missionBriefing: "Stage 3: Leadership and culture fit. Explore their values, teamwork, and growth mindset.",
                    stagePersonality: "Be thoughtful and reflective. Focus on their perspective on collaboration and leadership."
                };
        }
    }
    
    return {
        missionBriefing: `Focused ${interviewType} interview session.`,
        stagePersonality: "Be professional yet personable, adapting to their communication style."
    };
}

function buildResponseContext(answerType, sentiment, emotions) {
    switch (answerType) {
        case "empty":
            return "They didn't answer - gently encourage them: 'No worries, take your time. What comes to mind?'";
        case "dont_know":
            return "They're unsure - be supportive: 'That's totally okay! Let's think through this together...'";
        case "too_short":
            return "Brief answer - show interest and ask for more: 'Interesting! Can you tell me more about that?'";
        case "uncertain":
            return "They seem hesitant - reassure them: 'You're on the right track. What's your instinct telling you?'";
        case "too_long":
            return "Detailed answer - acknowledge and focus: 'I appreciate all those details. What was the key turning point?'";
        default:
            return "Good answer - acknowledge it naturally before moving forward.";
    }
}

function buildEndInterviewPrompt(reason) {
    const prompts = {
        unprofessional_behavior: `You need to end the interview professionally due to repeated inappropriate language.

Respond with understanding but firmness:
"I understand interviews can be stressful, but maintaining professionalism is important to us. We'll need to conclude our conversation here. Thank you for your time."

{"action": "END_INTERVIEW", "dialogue": "I understand interviews can be stressful, but maintaining professionalism is important to us. We'll need to conclude our conversation here. Thank you for your time.", "category": "behavioral", "difficulty": "easy"}`,
        
        natural_conclusion: `The interview has reached a natural conclusion. End warmly and positively.

{"action": "END_INTERVIEW", "dialogue": "This has been a really insightful conversation! I've enjoyed learning about your background and experience. We'll be in touch soon with next steps.", "category": "behavioral", "difficulty": "easy"}`
    };
    
    return prompts[reason] || prompts.natural_conclusion;
}

function buildWarningPrompt() {
    return `You need to address inappropriate language professionally but give them another chance.

Stay calm and redirect: "I need us to keep our conversation professional. I understand interviews can be nerve-wracking - let's take a breath and try that question again."

Respond ONLY with JSON:
{"action": "CONTINUE", "dialogue": "I need us to keep our conversation professional. I understand interviews can be nerve-wracking - let's take a breath and try that question again.", "category": "behavioral", "difficulty": "easy"}`;
}

async function callGemini(prompt, session, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.8, // Higher temperature for more personality
                    maxOutputTokens: 600,
                    topP: 0.9,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const rawText = result.response.text().trim();
            
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                if (!parsed.action || !parsed.dialogue) {
                    throw new Error("Invalid response structure");
                }
                
                if (parsed.action === "CONTINUE" && !parsed.category) {
                    parsed.category = "behavioral";
                }
                
                return parsed;
            }

            throw new Error("No valid JSON found in response");

        } catch (error) {
            console.error(`Gemini API attempt ${attempt}/${retries} failed:`, error.message);
            
            if (attempt === retries) {
                return { 
                    action: "END_INTERVIEW", 
                    dialogue: "I'm having some technical difficulties on my end. Thank you so much for your time today - this has been a great conversation and we'll follow up soon!", 
                    category: "behavioral", 
                    difficulty: "easy" 
                };
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

function pruneSessionMessages(session, maxMessages = 15) {
    if (session.messages && session.messages.length > maxMessages) {
        // Keep the first message (greeting) and recent messages
        const recent = session.messages.slice(-(maxMessages - 1));
        session.messages = [session.messages[0], ...recent];
    }
    return session;
}

async function safeGeminiCall(prompt, session) {
    try {
        session = pruneSessionMessages(session);
        
        const response = await callGemini(prompt, session);
        
        console.log(`[GEMINI] Human-like response: ${response.action} - ${response.dialogue?.substring(0, 80)}...`);
        
        return response;
    } catch (error) {
        console.error("[GEMINI] Critical error:", error);
        
        return {
            action: "END_INTERVIEW",
            dialogue: "You know what, I'm running into some technical issues on my end. But I've really enjoyed our conversation today! We'll be in touch with next steps soon.",
            category: "behavioral",
            difficulty: "easy"
        };
    }
}

module.exports = {       
    analyzeAnswerHeuristic, 
    buildInterviewerPrompt, 
    callGemini: safeGeminiCall,
    detectAnswerType,
    pruneSessionMessages,
    analyzeSentiment,
    detectEmotions,
    buildPersonalizedContext
};