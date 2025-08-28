// /utils/aiQuestionGen.js - FINAL ROBUST VERSION
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateAiQuestion(context) {
    const { role, company, type, interviewType, difficulty, history } = context;
    const previousQuestions = history.map(item => `- ${item.question.text}`).join('\n');
    const prompt = `You are an expert technical interviewer for a ${role} position at ${company || 'a top tech company'}. Generate one interview question. The round is ${interviewType}. Constraints: Type: ${type}, Difficulty: ${difficulty}. Do not repeat these previous questions: ${previousQuestions}. Respond ONLY with a single, raw JSON object with keys: "text", "category", "difficulty". For "coding" questions, also include a "language_id": 93 for JavaScript.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let content = response.text();

        // --- ROBUST JSON EXTRACTION ---
        // This regex finds a JSON object even if there's text before or after it.
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No valid JSON object found in AI response.");
        }
        
        const jsonResponse = JSON.parse(jsonMatch[0]);
        // --- END OF FIX ---

        if (jsonResponse.text && jsonResponse.category && jsonResponse.difficulty) {
            return jsonResponse;
        } else {
            throw new Error("Invalid JSON structure from AI.");
        }
    } catch (error) {
        console.error("AI Question Generation Failed (Gemini):", error.message);
        return null;
    }
}
module.exports = { generateAiQuestion };