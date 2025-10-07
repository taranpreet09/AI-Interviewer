// AI_interviewer/Backend/routes/__tests__/dashboard.test.js

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const Session = require('../../models/session');
const Question = require('../../models/Question');

describe('Dashboard API Endpoints', () => {
    let testSession;
    let question1, question2;

    beforeAll(async () => {
        question1 = await new Question({
            text: 'This is the first question.',
            category: 'behavioral',
            difficulty: 'easy',
            source: 'seed'
        }).save();
        question2 = await new Question({
            text: 'This is the second question.',
            category: 'theory',
            difficulty: 'medium',
            source: 'seed',
            // Add the idealAnswer for theory questions
            idealAnswer: 'This is the ideal answer for the second question.'
        }).save();
    });

    beforeEach(async () => {
        const sessionData = {
            role: 'Test Role',
            interviewType: 'Technical Screen',
            interviewMode: 'full',
            history: [{
                question: question1._id,
                userAnswer: 'Answer 1',
                analysis: {
                    score: 4.0
                },
                timestampStart: new Date(Date.now() - 60000),
                timestampEnd: new Date(),
            }, {
                question: question2._id,
                userAnswer: 'Answer 2',
                analysis: {
                    score: 3.5
                },
                timestampStart: new Date(Date.now() - 120000),
                timestampEnd: new Date(),
            }, ],
        };
        testSession = await new Session(sessionData).save();
    });

    afterEach(async () => {
        await Session.deleteMany({});
    });

    afterAll(async () => {
        await Question.deleteMany({});
        await mongoose.connection.close();
    });

    describe('GET /api/dashboard/:sessionId', () => {
        it('should return analytics data for a valid session', async () => {
            const response = await request(app)
                .get(`/api/dashboard/${testSession._id}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('summary');
            expect(response.body.summary.averageScore).toBe(3.8);
            expect(response.body.confidenceData.length).toBe(2);
            expect(response.body.timeData.length).toBe(2);
            expect(response.body.categoryPerformance.length).toBeGreaterThan(0);
        });

        it('should return 404 for a non-existent session', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/dashboard/${fakeId}`);

            expect(response.statusCode).toBe(404);
        });
    });
});