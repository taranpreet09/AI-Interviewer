// routes/__tests__/interview.test.js

const request = require('supertest');
const app = require('../../server'); // Import your app
const mongoose = require('mongoose');
const Session = require('../../models/session');

describe('Interview API Endpoints', () => {

  // This will hold the session created before each test
  let testSession;

  // Before each test, create a fresh interview session
  beforeEach(async () => {
    const interviewData = {
      interviewType: 'Behavioral',
      interviewMode: 'specific',
      role: 'Junior Developer',
      company: 'TestCorp'
    };
    // We create the session directly in the DB for speed and control
    testSession = await new Session(interviewData).save();
  });

  // After each test, clean up by deleting the session
  afterEach(async () => {
    if (testSession) {
      await Session.findByIdAndDelete(testSession._id);
    }
  });

  // After all tests are done, close the DB connection
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

      // Check the HTTP response
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('greeting');
      expect(response.body.greeting).toContain('Technical Screen'); //
      
      // Check the database
      const sessionInDb = await Session.findById(response.body.sessionId);
      expect(sessionInDb).not.toBeNull();
      expect(sessionInDb.role).toBe('Senior Developer'); //
      
      // Cleanup this specific session since it's not handled by beforeEach
      await Session.findByIdAndDelete(response.body.sessionId);
    });
  });

  // NEW TEST SUITE
  describe('POST /api/interview/next-step', () => {

    
it('should process an answer, update history, and return the next step', async () => {
  // The 'testSession' was created in the beforeEach hook
  const nextStepData = {
    sessionId: testSession._id,
    answer: 'I would describe myself as a proactive and collaborative team member who is passionate about building clean and efficient code.'
  };

  const response = await request(app)
    .post('/api/interview/next-step')
    .send(nextStepData);

  // 1. Check the HTTP Response
  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty('action', 'CONTINUE');
  expect(response.body).toHaveProperty('dialogue');
  expect(response.body).toHaveProperty('sessionStatus', 'ongoing');

  // 2. Check the Database
  const updatedSession = await Session.findById(testSession._id);

  // FIX: The `history` array now contains the FIRST QUESTION from the AI, which is still unanswered.
  expect(updatedSession.history.length).toBe(1);
  expect(updatedSession.history[0].userAnswer).toBe(''); // The userAnswer for the new question is empty.

  // FIX: The `messages` array correctly stores the user's initial answer.
  expect(updatedSession.messages.length).toBe(2); // Should contain the user's answer and the AI's new question
  expect(updatedSession.messages[0].role).toBe('user');
  expect(updatedSession.messages[0].content).toBe(nextStepData.answer);
  expect(updatedSession.messages[1].role).toBe('assistant');
    });
  });
});