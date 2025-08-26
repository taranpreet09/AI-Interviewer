// /routes/interview.js
const express = require('express');
const axios = require('axios');
const Session = require('../models/session');
const router = express.Router();

// --- Interview Plan Configuration ---
const interviewPlans = {
    'DSA': {
        behavioral: ["Tell me about a time you faced a difficult bug.", "How do you keep your technical skills sharp?"],
        theory: ["What is the difference between an array and a linked list?", "Explain Big O notation."],
        coding: [{
            text: "Write a function to reverse a string.",
            language_id: 93 // JavaScript
        }]
    },
    'System Design': {
        behavioral: ["Describe a complex system you have designed or worked on.", "How do you handle disagreements on a technical design?"],
        theory: ["What is database sharding?", "Explain the concept of a load balancer."],
        coding: [{
            text: "Design a URL shortening service like TinyURL. Describe the API endpoints and data model. (Provide your answer in markdown format).",
            language_id: 71 // Python
        }]
    },
    'HR': {
        behavioral: ["What are your biggest strengths and weaknesses?", "Where do you see yourself in 5 years?"],
        theory: ["How would you handle a conflict with a coworker?", "What does 'company culture' mean to you?"],
        coding: [{
            text: "This is an HR interview. There is no coding question. Describe your ideal work environment.",
            language_id: 52 // C++ (placeholder)
        }]
    }
};

function generatePlan(type) {
    const plan = interviewPlans[type];
    return [
        { type: 'behavioral', text: plan.behavioral[0] },
        { type: 'theory', text: plan.theory[0] },
        { type: 'behavioral', text: plan.behavioral[1] },
        { type: 'theory', text: plan.theory[1] },
        { type: 'coding', text: plan.coding[0].text, language_id: plan.coding[0].language_id },
    ];
}

// POST /start -> Start a new interview session
router.post('/start', async (req, res) => {
    try {
        const { role, company, interviewType } = req.body;
        if (!interviewPlans[interviewType]) {
            return res.status(400).json({ message: 'Invalid interview type' });
        }

        const questions = generatePlan(interviewType);
        const newSession = new Session({
            role,
            company: company || 'N/A',
            interviewType,
            questions
        });
        await newSession.save();

        res.status(201).json({
            sessionId: newSession._id,
            firstQuestion: newSession.questions[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});
// POST /ask -> Submit an answer and get the next question
router.post('/ask', async (req, res) => {
    try {
        const { sessionId, answer } = req.body;
        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.status === 'completed') return res.status(400).json({ message: 'Interview already completed' });

        // Save the answer for the current question
        session.questions[session.currentQuestionIndex].userAnswer = answer;

        // Advance to the next question
        session.currentQuestionIndex++;

        await session.save();

        if (session.currentQuestionIndex >= session.questions.length) {
            session.status = 'completed';
            await session.save();
            return res.json({ message: 'Interview completed!', finished: true });
        } else {
            return res.json({ nextQuestion: session.questions[session.currentQuestionIndex] });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/session/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId);
        if (!session) {
            // This inner 404 means the session ID itself wasn't found in the DB
            return res.status(404).json({ message: 'Session not found in database' });
        }
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// POST /feedback -> Get AI feedback for an answer
router.post('/feedback', async (req, res) => {
    const { question, answer, sessionId, questionIndex } = req.body;

    // --- Mock AI Feedback ---
    // In a real application, you would call OpenAI/Gemini API here.
    // For now, we return a placeholder based on keywords.
    let feedback = "That's a good start. ";
    if (answer.length > 50) {
        feedback += "You've provided a detailed response. To improve, you could try to be a bit more concise.";
    } else if (answer.length < 10) {
        feedback += "This answer is a bit short. Try to elaborate more on your points.";
    } else {
        feedback += "Consider providing a specific example to support your statement.";
    }
    
    // Save feedback to the session
    try {
        const session = await Session.findById(sessionId);
        if (session) {
            session.questions[questionIndex].aiFeedback = feedback;
            await session.save();
        }
    } catch(err) {
        console.error("Could not save feedback:", err.message);
    }


    res.json({ feedback });
});

// POST /code/submit -> Execute code using Judge0
router.post('/code/submit', async (req, res) => {
    const { source_code, language_id, sessionId, questionIndex } = req.body;

    const options = {
        method: 'POST',
        url: `https://${process.env.JUDGE0_API_HOST}/submissions`,
        params: { base64_encoded: 'false', wait: 'true' },
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Host': process.env.JUDGE0_API_HOST,
            'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        },
        data: {
            language_id: language_id,
            source_code: source_code,
        },
    };

    try {
        const response = await axios.request(options);
        const result = {
            stdout: response.data.stdout,
            stderr: response.data.stderr,
            status: response.data.status.description,
        };

        // Save result to session
        const session = await Session.findById(sessionId);
        if (session) {
            session.questions[questionIndex].codeResult = result;
            await session.save();
        }

        res.json(result);
    } catch (error) {
        console.error("Judge0 Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Error executing code', error: error.message });
    }
});


module.exports = router;