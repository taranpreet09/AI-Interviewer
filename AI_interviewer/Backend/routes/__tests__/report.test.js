// routes/__tests__/report.test.js

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const Session = require('../../models/session');
const Question = require('../../models/Question');

// --- Mocking Setup ---
// We import the module we want to mock
const aiEvaluator = require('../../utils/aiEvaluator');

// This line tells Jest to replace the actual aiEvaluator module with a mock version.
// All functions exported from aiEvaluator (e.g., evaluateBehavioral) will be replaced with dummy functions.
jest.mock('../../utils/aiEvaluator');
// --- End Mocking Setup ---


describe('Report API Endpoints', () => {
    let testSession;
    let behavioralQuestion, theoryQuestion;

    // Before all tests, connect to the database and create some sample questions
    beforeAll(async () => {
        behavioralQuestion = await new Question({ text: 'Tell me about a time you worked in a team.', category: 'behavioral', difficulty: 'medium', source: 'seed' }).save();
        theoryQuestion = await new Question({ text: 'What is a REST API?', category: 'theory', difficulty: 'medium', source: 'seed', idealAnswer: 'An API that follows REST constraints.' }).save();
    });

    // Before each test, create a realistic, completed session with history
    beforeEach(async () => {
        testSession = await new Session({
            role: 'Software Engineer',
            interviewType: 'Full Stack Engineer',
            interviewMode: 'full',
            status: 'completed', // The session must be 'completed' for the report to generate
            history: [
                { question: behavioralQuestion._id, userAnswer: 'I worked well with my team on a challenging project.' },
                { question: theoryQuestion._id, userAnswer: 'It is a type of web service.' }
            ]
        }).save();

        // Before each test, we also clear any previous mock usage history
        jest.clearAllMocks();
    });

    // After all tests, clean up the questions and close the DB connection
    afterAll(async () => {
        await Question.deleteMany({});
        await Session.deleteMany({});
        await mongoose.connection.close();
    });


    describe('GET /api/analyze/session/:sessionId', () => {

        it('should generate a report using mocked AI evaluations', async () => {
            // 1. Arrange: Configure our mock functions to return predictable data
            // We use .mockResolvedValue() because the original functions are async
            aiEvaluator.evaluateBehavioral.mockResolvedValue({ score: 4.2, details: 'Good STAR method.', tips: 'Add more metrics.' });
            aiEvaluator.evaluateTheory.mockResolvedValue({ score: 3.5, details: 'Correct but lacks depth.', tips: 'Explain the constraints.' });
            aiEvaluator.generateFinalSummary.mockResolvedValue({ strengths: 'Clear communication.', weaknesses: 'Needs more technical detail.', nextSteps: 'Study REST principles.' });

            // 2. Act: Call the API endpoint
            const response = await request(app)
                .get(`/api/analyze/session/${testSession._id}`);

            // 3. Assert: Check the results
            // Check the HTTP response
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('overallScore');
            expect(response.body).toHaveProperty('summary');
            expect(response.body.summary.strengths).toBe('Clear communication.'); // Check if our mocked summary was used

            // Check that the detailed feedback matches our mocked data
            expect(response.body.detailedFeedback.length).toBe(2);
            expect(response.body.detailedFeedback[0].score).toBe(4.2);

            // Check that our mock functions were called correctly
            expect(aiEvaluator.evaluateBehavioral).toHaveBeenCalledTimes(1);
            expect(aiEvaluator.evaluateTheory).toHaveBeenCalledTimes(1);
            expect(aiEvaluator.generateFinalSummary).toHaveBeenCalledTimes(1);

            // Check that the report was saved to the database
            const sessionInDb = await Session.findById(testSession._id);
            expect(sessionInDb.report).not.toBeNull();
            expect(sessionInDb.report.overallScore).toBeGreaterThan(0);
        });
    });
});