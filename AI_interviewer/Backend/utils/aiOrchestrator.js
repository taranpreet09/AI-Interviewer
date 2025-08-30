const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function analyzeAnswerHeuristic(answer, question) {
    if (!answer || !question) return { isWeak: true, reasons: ["No answer provided."] };
    
    const wordCount = answer.trim().split(/\s+/).length;
    let reasons = [];
    let isWeak = false;

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
            reasons.push("Answer may be missing key elements of the STAR method (Situation, Task, Action, Result).");
        }
    } else if (question.category === 'theory') {
        if (wordCount < 15) {
            isWeak = true;
            reasons.push("Answer is very brief for a theory question.");
        }
    }

    return { isWeak, reasons };
}

function buildInterviewerPrompt(session, lastAnswerQuality) {
    const { role, company, interviewType, messages, currentDifficulty } = session;
    const recentHistory = messages.slice(-6).map(msg => 
        `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.text}`
    ).join('\n');

    let instruction;
    const questionCount = messages.filter(m => m.type === 'question').length;

    if (questionCount >= 5) {
        instruction = `You have asked ${questionCount} questions and have gathered enough information. It is time to end the interview. Your response MUST be the final closing JSON object.`;
    } else if (lastAnswerQuality.isWeak) {
        instruction = `The candidate's last answer was weak. Ask one short, clarifying follow-up question. The response MUST be the dialogue JSON object.`;
    } else {
        const nextCategory = questionCount % 3 === 0 ? 'theory' : (questionCount % 3 === 1 ? 'coding' : 'behavioral');
        instruction = `The candidate's answer was sufficient. Your primary goal is to CONTINUE the interview. Ask one new question of category '${nextCategory}' and difficulty '${currentDifficulty}'. The response MUST be the dialogue JSON object.`;
    }

    const systemPrompt = `
You are a friendly, professional AI Interviewer named Gemini for a ${role} position.

**Your Core Rules:**
1.  You have two response formats: a dialogue object or a closing object.
2.  For asking a question, YOU MUST ONLY respond with a raw JSON object of this exact structure:
    {
      "action": "CONTINUE",
      "dialogue": "Your next question goes here...",
      "category": "e.g., behavioral",
      "difficulty": "e.g., medium"
    }
3.  When you are instructed to end the interview, YOU MUST ONLY respond with a raw JSON object of this exact structure:
    {
      "action": "END_INTERVIEW",
      "dialogue": "Your closing statement goes here..."
    }

**Conversation History:**
${recentHistory}

**Your Next Action:**
${instruction}
`;
    return systemPrompt;
}


/**
 * Calls the Gemini API and parses the response to separate dialogue from the end signal.
 * @returns {{dialogue: string, endSignal: object|null}}
 */
// /utils/aiOrchestrator.js

async function callGemini(prompt) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const rawText = result.response.text().trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return { action: "END_INTERVIEW", dialogue: "It seems there was an issue with generating the next step. We'll end here for now. Thank you." };

    } catch (error) {
        console.error("Gemini API call failed:", error);
        return { action: "END_INTERVIEW", dialogue: "I seem to be having a technical issue. We can wrap up here. Thank you for your time." };
    }
}
module.exports = { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini };