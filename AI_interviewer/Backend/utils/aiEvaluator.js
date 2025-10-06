const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const delay = ms => new Promise(res => setTimeout(res, ms));

// Enhanced API call function with better error handling and timeouts
async function callAiForJson(prompt, maxRetries = 3, timeoutMs = 15000, maxOutputTokens = 300) {
    let retries = maxRetries;
    
    while (retries > 0) {
        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1, // Lower temperature for more consistent responses
                    maxOutputTokens, // Reasonable limit for evaluation responses
                }
            });

            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API call timeout')), timeoutMs);
            });

            // Race between API call and timeout
            const apiCallPromise = model.generateContent(prompt);
            const result = await Promise.race([apiCallPromise, timeoutPromise]);
            
            const response = await result.response;
            const content = response.text();
            
            // Validate JSON content before parsing
            if (!content || content.trim().length === 0) {
                throw new Error("Empty response from AI");
            }
            
            return JSON.parse(content);
            
        } catch (error) {
            retries--;
            console.error(`AI Evaluation Failed. Retries left: ${retries}. Error:`, error.message);
            
            if (retries === 0) {
                console.error("All retries exhausted for AI evaluation");
                return null;
            }
            
            // Exponential backoff: wait longer between retries
            await delay(1000 * (maxRetries - retries + 1));
        }
    }
}

async function evaluateBehavioral(question, answer) {
    // Input validation
    if (!question || !answer) {
        return {
            score: 1.0,
            details: "Missing question or answer for evaluation",
            tips: "Please provide both question and answer for proper evaluation"
        };
    }

    // Handle very short or "I don't know" responses
    if (answer.toLowerCase().includes("i don't know") || answer.trim().length < 10) {
        return {
            score: 1.5,
            details: "Answer indicates uncertainty or lacks detail",
            tips: "Try to think of similar experiences from school projects, internships, or personal initiatives"
        };
    }

    const prompt = `You are an experienced hiring manager evaluating a behavioral interview answer.

Question: "${question}"
Answer: "${answer}"

Evaluate based on:
- STAR structure (Situation, Task, Action, Result)
- Specific examples and details
- Professional impact and learning

Respond with JSON only:
{"score": number between 1-5, "details": "brief analysis", "tips": "one improvement tip"}`;

    const result = await callAiForJson(prompt);
    
    // Fallback evaluation if AI fails
    if (!result) {
        console.warn("AI evaluation failed, using heuristic fallback");
        return heuristicBehavioralEval(answer);
    }
    
    return result;
}

async function evaluateTheory(question, idealAnswer, userAnswer) {
    if (!question || !userAnswer) {
        return {
            score: 1.0,
            details: "Missing question or answer for evaluation",
            tips: "Please provide a complete answer to the theoretical question"
        };
    }

    // Handle "I don't know" responses
    if (userAnswer.toLowerCase().includes("i don't know") || userAnswer.trim().length < 15) {
        return {
            score: 1.5,
            details: "Answer shows lack of knowledge on the topic",
            tips: "Review fundamental concepts in this area"
        };
    }

    const prompt = `You are a senior engineer comparing theoretical knowledge.

Question: "${question}"
Expected Answer: "${idealAnswer || 'Not provided'}"
Candidate Answer: "${userAnswer}"

Evaluate accuracy, completeness, and clarity.

Respond with JSON only:
{"score": number between 1-5, "details": "brief comparison", "tips": "one improvement tip"}`;

    const result = await callAiForJson(prompt);
    
    if (!result) {
        console.warn("AI evaluation failed, using heuristic fallback");
        return heuristicTheoryEval(userAnswer, idealAnswer);
    }
    
    return result;
}

async function evaluateCoding(question, code) {
    if (!question || !code) {
        return {
            score: 1.0,
            details: "Missing problem statement or code solution",
            tips: "Please provide a complete code solution"
        };
    }

    // Handle non-code responses
    if (!code.includes('function') && !code.includes('def') && !code.includes('class') && code.length < 20) {
        return {
            score: 1.5,
            details: "Response doesn't appear to contain code",
            tips: "Please provide an actual code solution to the problem"
        };
    }

    const prompt = `You are a staff engineer reviewing code.

Problem: "${question}"
Code: "${code}"

Evaluate:
- Code structure and readability  
- Logic and approach
- Potential efficiency

Do NOT test for correctness - only review code quality.

Respond with JSON only:
{"score": number between 1-5, "details": "brief code review", "tips": "one improvement tip"}`;

    const result = await callAiForJson(prompt);
    
    if (!result) {
        console.warn("AI evaluation failed, using heuristic fallback");
        return heuristicCodingEval(code);
    }
    
    return result;
}

async function generateFinalSummary(allFeedback) {
    if (!allFeedback || allFeedback.length === 0) {
        return {
            strengths: "Unable to generate summary - insufficient feedback data",
            weaknesses: "No specific areas identified",
            nextSteps: "Complete more interview questions for detailed analysis"
        };
    }

    // Clean and format feedback data
    const feedbackText = allFeedback.map((fb, index) => 
        `${index + 1}. ${fb.question || 'Question'}: ${fb.answer || 'No answer'} (Score: ${fb.score || 'N/A'})`
    ).join('\n');

    const prompt = `You are a recruiter summarizing interview performance.

Interview Feedback:
${feedbackText}

Identify patterns and provide actionable insights.

Respond with JSON only:
{"strengths": "key strengths observed", "weaknesses": "main areas for improvement", "nextSteps": "specific action items"}`;

    const result = await callAiForJson(prompt, 2, 20000,1000); // Allow more time for summary
    
    if (!result) {
        console.warn("Summary generation failed, using fallback");
        return generateFallbackSummary(allFeedback);
    }
    
    return result;
}

// Heuristic fallback functions when AI evaluation fails

function heuristicBehavioralEval(answer) {
    let score = 2.0;
    const wordCount = answer.split(' ').length;
    
    if (wordCount > 50) score += 1.0;
    if (wordCount > 100) score += 0.5;
    if (/situation|context|project/i.test(answer)) score += 0.5;
    if (/action|did|implemented|led/i.test(answer)) score += 0.5;
    if (/result|outcome|impact|achieved/i.test(answer)) score += 0.5;
    
    return {
        score: Math.min(5.0, score),
        details: `Response length: ${wordCount} words. Contains some behavioral elements.`,
        tips: "Structure your answer using STAR method for better impact"
    };
}

function heuristicTheoryEval(userAnswer, idealAnswer) {
    let score = 2.0;
    const wordCount = userAnswer.split(' ').length;
    
    if (wordCount > 30) score += 1.0;
    if (wordCount > 60) score += 0.5;
    if (idealAnswer && userAnswer.toLowerCase().includes(idealAnswer.split(' ')[0].toLowerCase())) {
        score += 1.0;
    }
    
    return {
        score: Math.min(5.0, score),
        details: `Answer covers basic points. Length: ${wordCount} words.`,
        tips: "Add more specific examples and technical details"
    };
}

function heuristicCodingEval(code) {
    let score = 2.0;
    
    if (code.includes('function') || code.includes('def')) score += 1.0;
    if (code.includes('return')) score += 0.5;
    if (code.includes('for') || code.includes('while') || code.includes('forEach')) score += 0.5;
    if (code.includes('//') || code.includes('#')) score += 0.5; // Comments
    
    return {
        score: Math.min(5.0, score),
        details: "Code contains basic programming structures and syntax",
        tips: "Add comments and consider edge cases"
    };
}

function generateFallbackSummary(allFeedback) {
    const totalScore = allFeedback.reduce((sum, fb) => sum + (fb.score || 0), 0);
    const averageScore = totalScore / allFeedback.length;
    
    let strengths = "Shows engagement with the interview process";
    let weaknesses = "Areas for development identified";
    let nextSteps = "Continue practicing interview skills";
    
    if (averageScore > 3.5) {
        strengths = "Demonstrates solid understanding and communication skills";
        nextSteps = "Focus on advanced topics and leadership examples";
    } else if (averageScore < 2.5) {
        weaknesses = "Needs foundational skill development";
        nextSteps = "Review core concepts and practice structured responses";
    }
    
    return { strengths, weaknesses, nextSteps };
}

module.exports = { 
    evaluateBehavioral, 
    evaluateTheory, 
    evaluateCoding, 
    generateFinalSummary, 
    callAiForJson,
    heuristicBehavioralEval,    // <-- ADD THIS
    heuristicTheoryEval,      // <-- ADD THIS
    heuristicCodingEval       // <-- ADD THIS
};