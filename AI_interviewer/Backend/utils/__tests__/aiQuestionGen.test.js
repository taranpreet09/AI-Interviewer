// AI_interviewer/Backend/utils/__tests__/aiQuestionGen.test.js

// Define the mock functions first.
const mockGenerateContent = jest.fn();

// Now, mock the module. This call is hoisted by Jest.
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
        }),
    })),
}));

// THEN, import the module that uses the mock.
const {
    generateAiQuestion,
    validateQuestionQuality,
    generateFallbackQuestion,
    extractPersonalizationElements,
} = require('../aiQuestionGen');


describe('AI Question Generation', () => {
    // Clear mock history before each test to ensure tests are isolated.
    beforeEach(() => {
        mockGenerateContent.mockClear();
    });

    describe('generateAiQuestion', () => {
        it('should generate a question via AI and return a valid format', async () => {
            const context = {
                role: 'Software Engineer',
                type: 'behavioral',
                difficulty: 'medium',
                history: [],
            };

            const mockResponse = {
                text: 'Tell me about a challenging project.',
                category: 'behavioral',
                difficulty: 'medium',
            };

            // Configure the mock's resolved value for this specific test case.
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify(mockResponse),
                },
            });

            const result = await generateAiQuestion(context);

            expect(result).toHaveProperty('text', 'Tell me about a challenging project.');
            expect(result).toHaveProperty('category', 'behavioral');
            expect(result).toHaveProperty('difficulty', 'medium');
            expect(result).toHaveProperty('contextualRelevance');
        });
    });

    describe('generateFallbackQuestion', () => {
        it('should generate a relevant behavioral fallback question', () => {
            const context = {
                type: 'behavioral',
                difficulty: 'easy',
                role: 'Junior Developer',
                history: []
            };
            const question = generateFallbackQuestion(context);
            expect(question.category).toBe('behavioral');
            expect(question.difficulty).toBe('easy');
            expect(question.text).toBeDefined();
        });

        it('should generate a relevant theory fallback question with context', () => {
            const context = {
                type: 'theory',
                difficulty: 'medium',
                role: 'Senior Developer',
                history: []
            };
            const question = generateFallbackQuestion(context);
            expect(question.category).toBe('theory');
            expect(question.text).toContain('microservices');
        });
    });

    describe('validateQuestionQuality', () => {
        it('should approve a high-quality question', () => {
            const question = {
                text: 'Considering your experience at a fast-paced startup, how do you handle tight deadlines?'
            };
            const context = {
                candidateContext: 'Worked at a fast-paced startup.',
                history: []
            };
            const result = validateQuestionQuality(question, context);
            expect(result.isValid).toBe(true);
            expect(result.score).toBe(5);
        });

        it('should flag a question that is too short', () => {
            const question = {
                text: 'Why?'
            };
            const context = {
                history: []
            };
            const result = validateQuestionQuality(question, context);
            expect(result.isValid).toBe(false);
            expect(result.issues).toContain('Question too short');
        });
    });

    describe('extractPersonalizationElements', () => {
        it('should identify referenced technical topics in the question', () => {
            const questionText = 'Given your experience with React, how would you handle state management?';
            const conversationMemory = {
                technicalTopics: ['React', 'Node.js']
            };
            const elements = extractPersonalizationElements(questionText, conversationMemory);
            expect(elements).toContain('references_technical_background: React');
        });
    });
});