// AI_interviewer/Backend/routes/__tests__/report.test.js

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const Session = require('../../models/session');
const Question = require('../../models/Question');
const Report = require('../../models/report.model');

jest.mock('../../services/reportWorker', () => ({
    reportQueue: {
        add: jest.fn().mockResolvedValue(null),
    },
}));

describe('Report API Endpoints', () => {
    let testSession;
    let behavioralQuestion;

    beforeAll(async () => {
        behavioralQuestion = await new Question({
            text: 'Tell me about a time you worked in a team.',
            category: 'behavioral',
            difficulty: 'medium',
            source: 'seed',
            idealAnswer: 'A good answer would describe the situation, the task, the action, and the result.'
        }).save();
    });

    beforeEach(async () => {
        testSession = await new Session({
            role: 'Software Engineer',
            interviewType: 'Behavioral',
            interviewMode: 'specific',
            status: 'completed',
            history: [{
                question: behavioralQuestion._id,
                userAnswer: 'I collaborated with my team to deliver the project on time.'
            }]
        }).save();
    });

    afterEach(async () => {
        await Session.deleteMany({});
        await Report.deleteMany({});
    });

    afterAll(async () => {
        await Question.deleteMany({});
        await mongoose.connection.close();
    });


    describe('GET /api/report/analyze/session/:sessionId', () => {

        it('should start the report generation and return a 202 status', async () => {
            const {
                reportQueue
            } = require('../../services/reportWorker');

            const response = await request(app)
                .get(`/api/report/analyze/session/${testSession._id}`);

            expect(response.statusCode).toBe(202);
            expect(response.body).toHaveProperty('reportId');

            // Use expect.objectContaining to avoid strict type checks on ObjectId
            expect(reportQueue.add).toHaveBeenCalledWith(
                'generate-report',
                expect.objectContaining({
                    sessionId: testSession._id.toString(),
                })
            );

            // You can also add a separate assertion to ensure reportId exists in the call
            const queuePayload = reportQueue.add.mock.calls[0][1];
            expect(queuePayload).toHaveProperty('reportId');
        });
    });
});