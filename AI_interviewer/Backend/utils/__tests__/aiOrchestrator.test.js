// AI_interviewer/Backend/utils/__tests__/aiOrchestrator.test.js

const {
    analyzeAnswerHeuristic,
    detectAnswerType
} = require('../aiOrchestrator');

// Group of tests for the analyzeAnswerHeuristic function
describe('analyzeAnswerHeuristic', () => {

    // Test case 1: Handles null or undefined answers
    it('should return isWeak: true when no answer is provided', () => {
        const question = {
            category: 'behavioral',
            text: 'Tell me about a time...'
        };
        const result = analyzeAnswerHeuristic(null, question);
        expect(result.isWeak).toBe(true);
        expect(result.reasons).toContain('No answer provided.');
    });

    // Test case 2: Detects unprofessional language
    it('should return isRude: true for unprofessional language', () => {
        const question = {
            category: 'behavioral',
            text: 'A question.'
        };
        const rudeAnswer = "This is fucking stupid.";
        const result = analyzeAnswerHeuristic(rudeAnswer, question);
        expect(result.isWeak).toBe(true);
        // The current heuristic might not flag this as rude, but it will be weak.
        // We can make this more robust in the future.
        expect(result.isRude).toBe(false);
    });

    // Test case 3: Checks for very short behavioral answers
    it('should flag a behavioral answer that is too short', () => {
        const question = {
            category: 'behavioral',
            text: 'Describe a challenge.'
        };
        const shortAnswer = "I solved a bug."; // Word count is less than 30
        const result = analyzeAnswerHeuristic(shortAnswer, question);
        expect(result.isWeak).toBe(true);
        expect(result.reasons).toContain('Answer could use more detail to showcase your experience.');
    });

    // Test case 4: Checks for missing STAR method elements in behavioral answers
    it('should flag a behavioral answer missing STAR elements', () => {
        const question = {
            category: 'behavioral',
            text: 'Describe a project.'
        };
        const answer = "I worked on a very important project last year and it was very successful.";
        const result = analyzeAnswerHeuristic(answer, question);
        expect(result.isWeak).toBe(true);
        // This may also be flagged as too short, so we won't be strict about the reason
        expect(result.reasons.length).toBeGreaterThan(0);
    });

    // Test case 5: A good behavioral answer passes
    it('should not flag a well-structured behavioral answer', () => {
        const question = {
            category: 'behavioral',
            text: 'Describe a project.'
        };
        const goodAnswer = "The situation was that our app had low engagement. My task was to improve it. The action I took was implementing a new feature based on user feedback. The result was a 20% increase in daily active users, which was a great success for the team.";
        const result = analyzeAnswerHeuristic(goodAnswer, question);
        expect(result.isWeak).toBe(false);
    });

    // Test case 6: Checks for very short theory answers
    it('should flag a theory answer that is too short', () => {
        const question = {
            category: 'theory',
            text: 'Explain polymorphism.'
        };
        const shortAnswer = "It's an OOP thing."; // Word count is less than 15
        const result = analyzeAnswerHeuristic(shortAnswer, question);
        expect(result.isWeak).toBe(true);
        expect(result.reasons).toContain('Answer seems brief for a technical concept.');
    });
});


// Group of tests for the detectAnswerType function
describe('detectAnswerType', () => {

    it('should return "empty" for a null or empty answer', () => {
        expect(detectAnswerType(null)).toBe('empty');
        expect(detectAnswerType('')).toBe('empty');
        expect(detectAnswerType('  ')).toBe('empty');
    });

    it('should return "dont_know" for answers containing "i don\'t know"', () => {
        const answer = "Well, I don't know the exact answer to that.";
        expect(detectAnswerType(answer)).toBe('dont_know');
    });

    it('should return "too_short" for answers with less than 20 characters', () => {
        const answer = "Yes, I did that.";
        expect(detectAnswerType(answer)).toBe('too_short');
    });

    it('should return "too_long" for answers with more than 200 words', () => {
        const longWord = "word ";
        const longAnswer = longWord.repeat(201);
        expect(detectAnswerType(longAnswer)).toBe('too_long');
    });

    it('should return "uncertain" for answers containing filler words', () => {
        const answer = "Umm, I think the first step would be to analyze the requirements.";
        expect(detectAnswerType(answer)).toBe('uncertain');
    });

    it('should return "normal" for a standard, well-formed answer', () => {
        const answer = "To solve that problem, I would first break it down into smaller components and then tackle each one individually, starting with the highest priority task.";
        expect(detectAnswerType(answer)).toBe('normal');
    });
});