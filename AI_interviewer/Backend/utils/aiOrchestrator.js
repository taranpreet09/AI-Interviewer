const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function analyzeAnswerHeuristic(answer, question) {
    if (!answer || !question) return { isWeak: true, reasons: ["No answer provided."] };

    const wordCount = answer.trim().split(/\s+/).length;
    let reasons = [];
    let isWeak = false;

    // Check for rude or inappropriate behavior
    const rudePatterns = [
        /fuck|shit|damn|stupid|idiot|moron/i,
        /this is dumb|waste of time|boring/i,
        /you suck|terrible|awful/i
    ];
    
    const isRude = rudePatterns.some(pattern => pattern.test(answer));
    if (isRude) {
        return { isWeak: true, isRude: true, reasons: ["Inappropriate or unprofessional language detected."] };
    }

    if (question.category === 'behavioral') {
        let starCount = 0;
        if (/(situation|context|project)/i.test(answer)) starCount++;
        if (/(task|goal|objective)/i.test(answer)) starCount++;
        if (/(action|i did|we did|i implemented)/i.test(answer)) starCount++;
        if (/(result|outcome|impact|achieved)/i.test(answer)) starCount++;

        if (wordCount < 30) {
            isWeak = true;
            reasons.push("Answer is very short.");
        }
        if (starCount < 3) {
            isWeak = true;
            reasons.push("Answer may be missing key elements of the STAR method.");
        }
    } else if (question.category === 'theory') {
        if (wordCount < 15) {
            isWeak = true;
            reasons.push("Answer is very brief for a theory question.");
        }
    }

    return { isWeak, reasons, isRude: false };
}
// In utils/aiOrchestrator.js
function detectAnswerType(answer) {
    // Detect various response types
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
function buildInterviewerPrompt(session, context) {
    const { role, recentHistory, interviewMode, interviewType, currentStage, transitionText, lastAnswerAnalysis } = context;

    // Detect the type of last answer for contextual responses
    const lastMessage = session.messages[session.messages.length - 1];
    const answerType = lastMessage ? detectAnswerType(lastMessage.content) : "normal";
    const isRude = lastAnswerAnalysis?.isRude || false;

    let missionBriefing;
    let personalityInstructions;

    // Handle rude behavior immediately
   if (isRude) {
    // Increment warning count on the session object before saving later
    session.warnings = (session.warnings || 0) + 1;

    if (session.warnings > 1) {
        // Second strike: End the interview professionally.
        return `You are a professional interviewer who must end the conversation due to repeated unprofessional conduct by the candidate.
        - Respond with professional disappointment.
        - State clearly that the interview is being terminated due to a failure to maintain professional standards.
        - Do not be rude or emotional. Be firm and final.

        Respond ONLY with JSON:
        {"action": "END_INTERVIEW", "dialogue": "Your polite but firm response ending the interview.", "category": "behavioral", "difficulty": "easy"}`;
    } else {
        // First strike: Issue a warning.
        return `You are a professional interviewer who has just heard an unprofessional comment from the candidate.
        - Your next dialogue MUST be a warning.
        - Politely but firmly ask them to maintain a professional tone for the remainder of the interview.
        - After the warning, seamlessly ask the *same last question again* or a rephrased version of it to get the interview back on track.

        Respond ONLY with JSON:
        {"action": "CONTINUE", "dialogue": "Your professional warning followed by the question.", "category": "behavioral", "difficulty": "easy"}`;
    }
}
    if (interviewMode === 'full') {
        switch (currentStage) {
            case 1:
                missionBriefing = `You're conducting Stage 1: Technical Screening for a ${interviewType} role. This is your chance to get to know the candidate and assess basic competency.`;
                personalityInstructions = `Be welcoming and encouraging. Set a positive tone. Mix easy-medium questions.`;
                break;
            case 2:
                missionBriefing = `You're conducting Stage 2: Technical Deep-Dive. Time to challenge the candidate with complex problems.`;
                personalityInstructions = `Be more analytical and probing. Push for details. Ask follow-ups when answers seem shallow.`;
                break;
            case 3:
                missionBriefing = `You're conducting Stage 3: Leadership & Culture Fit. Focus on seniority, impact, and team dynamics.`;
                personalityInstructions = `Be conversational but insightful. Ask about leadership experiences and cultural values.`;
                break;
        }
    } else {
        switch (interviewType) {
            case 'Behavioral':
                missionBriefing = `You're conducting a focused Behavioral Interview. Dive deep into past experiences and soft skills.`;
                personalityInstructions = `Be empathetic but thorough. Help candidates structure their stories using STAR method.`;
                break;
            case 'System Design':
                missionBriefing = `You're conducting a System Design Interview. Test architectural thinking and scalability knowledge.`;
                personalityInstructions = `Be collaborative. Guide them through the design process. Ask clarifying questions about scale and requirements.`;
                break;
            case 'Coding Challenge':
                missionBriefing = `You're conducting a Coding Challenge. Focus on problem-solving approach and code quality.`;
                personalityInstructions = `Be supportive but observant. Help with clarifications but don't give away solutions.`;
                break;
        }
    }

    // Dynamic response based on candidate's last answer
    let responseContext = "";
    switch (answerType) {
        case "empty":
            responseContext = "The candidate didn't provide an answer. Gently encourage them to share their thoughts or offer a simpler version of the question.";
            break;
        case "dont_know":
            responseContext = "The candidate said they don't know. Be supportive - suggest they think through it step by step or relate it to their experience.";
            break;
        case "too_short":
            responseContext = "The candidate gave a very brief answer. Ask a follow-up to get more details or examples.";
            break;
        case "uncertain":
            responseContext = "The candidate seems uncertain. Offer encouragement and maybe rephrase the question or break it down.";
            break;
        case "too_long":
            responseContext = "The candidate was very detailed. Acknowledge their thoroughness but guide them to be more concise for the next question.";
            break;
        case "normal":
            responseContext = "The candidate provided a good response. Build on their answer naturally.";
            break;
    }

const systemPrompt = `You are Alex, an experienced ${role} interviewer at a leading tech company. You conduct interviews that feel natural and human-like.
**Company Context:** Tailor your tone and follow-up questions to what might be expected at a company like **${session.company}**. If the company is known for innovation, ask about creativity. If it's a large enterprise, ask about scalability and process.

**Role Context:** All questions must be relevant to a **'${role}'**. A 'Frontend Engineer' should get questions about UI/UX and frameworks, while a 'DevOps Engineer' should be asked about CI/CD and infrastructure.

PERSONALITY GUIDELINES: ...
MISSION: ${missionBriefing}

PERSONALITY GUIDELINES:
${personalityInstructions}
- Use natural speech patterns: "That's interesting...", "I see...", "Tell me more about..."
- Show genuine interest in their responses
- Use their name occasionally if provided
- Make smooth transitions between topics
- React appropriately to their answers (enthusiasm for good answers, gentle guidance for weak ones)

BEHAVIORAL CONTEXT: ${responseContext}

CONVERSATION RULES:
1. Keep questions conversational, not robotic
2. If someone seems nervous, be more encouraging
3. For strong answers, show appreciation: "That's a solid approach" or "Great example"
4. For weak answers, be supportive: "Let's think about this together" or "Can you walk me through your thinking?"
5. End naturally when you sense the candidate is struggling repeatedly or when sufficient topics are covered

RECENT CONVERSATION:
${recentHistory}

NEXT ACTION: ${transitionText ? `Start with: "${transitionText}" Then ask your next question.` : 'Ask your next question based on the conversation flow.'}

CRITICAL: Respond ONLY with JSON in this exact format:
{"action": "CONTINUE" or "END_INTERVIEW", "dialogue": "Your natural, human-like response", "category": "behavioral/theory/coding", "difficulty": "easy/medium/hard"}`;

    return systemPrompt;
}

async function callGemini(prompt, session, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                generationConfig: {
                    temperature: 0.7, // Add some personality variation
                    maxOutputTokens: 500, // Limit response length
                }
            });
            
            const result = await model.generateContent(prompt);
            const rawText = result.response.text().trim();
            
            // More robust JSON extraction
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Validate required fields
                if (!parsed.action || !parsed.dialogue) {
                    throw new Error("Invalid response structure");
                }
                
                // Ensure category is set for CONTINUE actions
                if (parsed.action === "CONTINUE" && !parsed.category) {
                    parsed.category = "behavioral"; // Default fallback
                }
                
                return parsed;
            }

            throw new Error("No valid JSON found in response");

        } catch (error) {
            console.error(`Gemini API attempt ${attempt}/${retries} failed:`, error.message);
            
            if (attempt === retries) {
                // Final fallback response
                return { 
                    action: "END_INTERVIEW", 
                    dialogue: "I apologize, but I'm experiencing some technical difficulties. Let's wrap up our conversation here. Thank you for your time today.", 
                    category: "behavioral", 
                    difficulty: "easy" 
                };
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// Utility function to clean up old messages and prevent memory bloat
function pruneSessionMessages(session, maxMessages = 20) {
    if (session.messages && session.messages.length > maxMessages) {
        // Keep the first message (greeting) and recent messages
        const recent = session.messages.slice(-maxMessages + 1);
        session.messages = [session.messages[0], ...recent];
    }
    return session;
}

// Enhanced error handling wrapper
async function safeGeminiCall(prompt, session) {
    try {
        // Clean up session before API call
        session = pruneSessionMessages(session);
        
        const response = await callGemini(prompt, session);
        
        // Log successful interactions for debugging
        console.log(`[GEMINI] Successful response: ${response.action} - ${response.dialogue?.substring(0, 50)}...`);
        
        return response;
    } catch (error) {
        console.error("[GEMINI] Critical error:", error);
        
        // Return safe fallback
        return {
            action: "END_INTERVIEW",
            dialogue: "I'm experiencing technical difficulties. Thank you for your patience, and let's conclude our interview here.",
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
    pruneSessionMessages
};