// AI_interviewer/Backend/routes/__tests__/interview.test.js

const request = require('supertest');
const app = require('../../server'); // Import your app
const mongoose = require('mongoose');
const Session = require('../../models/session');

describe('Interview API Endpoints', () => {

    let testSession;

    beforeEach(async () => {
        const interviewData = {
            interviewType: 'Behavioral',
            interviewMode: 'specific',
            role: 'Junior Developer',
            company: 'TestCorp'
        };
        testSession = await new Session(interviewData).save();
    });

    afterEach(async () => {
        if (testSession) {
            await Session.findByIdAndDelete(testSession._id);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });


    describe('POST /api/interview/start', () => {

        it('should create a new session and return a greeting', async () => {
            const interviewData = {
                interviewType: 'Technical Screen',
                interviewMode: 'full',
                role: 'Senior Developer',
            };

            const response = await request(app)
                .post('/api/interview/start')
                .send(interviewData);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('sessionId');
            expect(response.body).toHaveProperty('greeting');
            // The greeting is AI-generated, so we just check that it's a non-empty string
            expect(typeof response.body.greeting).toBe('string');
            expect(response.body.greeting.length).toBeGreaterThan(0);


            const sessionInDb = await Session.findById(response.body.sessionId);
            expect(sessionInDb).not.toBeNull();
            expect(sessionInDb.role).toBe('Senior Developer');

            await Session.findByIdAndDelete(response.body.sessionId);
        });
    });

    describe('POST /api/interview/next-step', () => {

        it('should process an answer, update history, and return the next step', async () => {
            const nextStepData = {
                sessionId: testSession._id,
                answer: 'I would describe myself as a proactive and collaborative team member who is passionate about building clean and efficient code.'
            };

            const response = await request(app)
                .post('/api/interview/next-step')
                .send(nextStepData);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('action', 'CONTINUE');
            expect(response.body).toHaveProperty('dialogue');
            expect(response.body).toHaveProperty('sessionStatus', 'ongoing');

            const updatedSession = await Session.findById(testSession._id);

            expect(updatedSession.history.length).toBe(1);

            expect(updatedSession.messages.length).toBe(2);
            expect(updatedSession.messages[0].role).toBe('user');
            expect(updatedSession.messages[0].content).toBe(nextStepData.answer);
            expect(updatedSession.messages[1].role).toBe('assistant');
        });
    });
});