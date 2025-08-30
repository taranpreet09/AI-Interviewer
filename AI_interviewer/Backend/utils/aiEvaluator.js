const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const delay = ms => new Promise(res => setTimeout(res, ms));
async function callAiForJson(prompt) {
    let retries = 3;
    while (retries > 0) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let content = response.text();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No valid JSON object found in AI response.");
            return JSON.parse(jsonMatch[0]); 
        } catch (error) {
            retries--;
            console.error(`AI Evaluation/Generation Failed. Retries left: ${retries}. Error:`, error.message);
            if (retries === 0) {
                return null;
            }
            await delay(1000); 
        }
    }
}

async function evaluateBehavioral(question, answer) {
    const prompt = `You are a hiring manager analyzing an interview transcript. Your task is to analyze the candidate's answer based on the type of question asked.

Question: "${question}"
Candidate's Answer: "${answer}"

**Instructions:**
1.  **Determine the question type.** Is it a classic behavioral question (e.g., "Tell me about a time...") that requires a story, OR is it a general/motivational question (e.g., "Why do you want to work here?")?
2.  **Apply the correct evaluation criteria.**
    * If it requires a story, analyze the answer's structure using the STAR method (Situation, Task, Action, Result).
    * If it's a general/motivational question, analyze the answer for clarity, enthusiasm, and relevance to the role and company.
3.  **Provide a score, details, and an actionable tip.** The tip should be specific to the candidate's actual answer.

Your response MUST be ONLY a raw JSON object with this exact structure: {"score": 3.5, "details": "A brief, one-sentence analysis of the answer based on the correct criteria.", "tips": "A single, actionable tip for improvement that is specific to the answer provided."}`;
    
    return await callAiForJson(prompt);
}
async function evaluateTheory(question, idealAnswer, userAnswer) {
    const prompt = `You are a senior engineer. Compare the candidate's answer to the ideal answer for the theory question. Question: "${question}". Ideal Answer: "${idealAnswer}". Candidate's Answer: "${userAnswer}". Evaluate how well it matches, noting missing key concepts. Your response MUST be ONLY a raw JSON object with this exact structure: {"score": 4.0, "details": "A brief, one-sentence analysis comparing the answers.", "tips": "A single, actionable tip highlighting a missing concept."}`;
    return await callAiForJson(prompt);
}

async function evaluateCoding(question, code) {
    const prompt = `You are a staff software engineer conducting a code review. Analyze the following JavaScript code snippet. Do not judge correctness, but evaluate its quality. Problem: "${question}". Code: "${code}". Your response MUST be ONLY a raw JSON object with this exact structure: {"score": 3.5, "details": "Analysis including Time Complexity (e.g., O(n)) and readability.", "tips": "A single, actionable tip to improve the code's structure or performance."}`;
    return await callAiForJson(prompt);
}
async function generateFinalSummary(allFeedback) {
    const prompt = `You are a professional recruiter writing a final summary for a candidate's interview performance based on the collected feedback. Feedback: ${JSON.stringify(allFeedback)}. Synthesize this into a final report. Your response MUST be ONLY a raw JSON object with this exact structure: {"strengths": "A concise bullet point list of 2-3 key strengths.", "weaknesses": "A concise bullet point list of 1-2 key areas for improvement.", "nextSteps": "A concise bullet point list of 2-3 actionable next steps for the candidate."}`;
    return await callAiForJson(prompt);
}

module.exports = { evaluateBehavioral, evaluateTheory, evaluateCoding, generateFinalSummary, callAiForJson };