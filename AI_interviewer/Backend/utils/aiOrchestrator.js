// /utils/aiOrchestrator.js
// NEW FILE - Contains the core logic for conversational AI

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * A simple heuristic to analyze the quality of a candidate's answer.
 */
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
    // The AI decides to end the interview after a sufficient number of questions.
    if (messages.filter(m => m.type === 'question').length >= 5) {
        instruction = `You have gathered enough information. It is time to end the interview. Thank the candidate for their time and give a short professional closing statement. Then, output the required JSON signal.`;
    } else if (lastAnswerQuality.isWeak) {
        instruction = `The candidate's last answer was weak. Reasons: ${lastAnswerQuality.reasons.join(' ')} Ask one short, clarifying follow-up question before moving on.`;
    } else {
        instruction = `Proceed to the next question smoothly, adjusting the difficulty to '${currentDifficulty}'.`;
    }

    const systemPrompt = `
You are a friendly, professional, and highly skilled AI Interviewer named Gemini.
Your task is to conduct an interview for a ${role} position at ${company || 'a top tech company'}. The round is focused on: ${interviewType}.

**Your Core Rules:**
1.  Ask only one question at a time.
2.  After the candidate answers, provide a brief, natural acknowledgment (e.g., "Thanks for sharing," "I see.") before your next question.
3.  Based on the candidate's performance, you may ask a clarifying follow-up question.
4.  **Crucially, after 5-7 questions, you must gracefully end the interview.**

**Ending the Interview:**
When you decide to end, you MUST first give a polite closing statement (e.g., "That concludes our session. Thank you for your responses.").
Immediately after your closing statement, on a new line, you MUST output the following JSON object and nothing else:
{
  "interview_end": true,
  "message": "The interview is now complete. Please generate performance analytics."
}

**Conversation History:**
${recentHistory}

**Your Next Action:**
${instruction}

**CRITICAL: Output ONLY the interviewer's dialogue. If ending, your dialogue must be followed by the required JSON object on a new line.**
`;
    return systemPrompt;
}


/**
 * Calls the Gemini API and parses the response to separate dialogue from the end signal.
 * @returns {{dialogue: string, endSignal: object|null}}
 */
async function callGemini(prompt) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const rawText = result.response.text().trim();

        // Check for the JSON end signal
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                const endSignal = JSON.parse(jsonMatch[0]);
                if (endSignal.interview_end === true) {
                    // Dialogue is everything before the JSON block
                    const dialogue = rawText.substring(0, jsonMatch.index).trim();
                    return { dialogue, endSignal };
                }
            } catch (e) {
                // Not a valid JSON signal, treat the whole thing as dialogue
                return { dialogue: rawText, endSignal: null };
            }
        }
        
        // No JSON signal found, the entire response is dialogue
        return { dialogue: rawText, endSignal: null };

    } catch (error) {
        console.error("Gemini API call failed:", error);
        return { dialogue: "I seem to be having a technical issue. We can wrap up here. Thank you for your time.", endSignal: { interview_end: true, message: "Failsafe Trigger" } };
    }
}
module.exports = { analyzeAnswerHeuristic, buildInterviewerPrompt, callGemini };