// AI_interviewer/Backend/utils/__tests__/aiEvaluator.test.js

const {
    heuristicBehavioralEval,
    heuristicTheoryEval,
    heuristicCodingEval
} = require('../aiEvaluator');

describe('heuristicBehavioralEval', () => {

    it('should give a baseline score for a very short answer', () => {
        const answer = "I did a project.";
        const result = heuristicBehavioralEval(answer);
        // The answer contains "did" and "project", so the score is 2.0 + 0.5 + 0.5 = 3.0
        expect(result.score).toBe(3.0);
    });

    it('should increase score for medium length answers (>50 words)', () => {
        const answer = "The situation was that our main product page was loading very slowly, which was causing a high bounce rate and frustrating our users. My primary task, assigned by my manager, was to investigate the performance bottlenecks and implement a solution to significantly decrease the page load time for all our customers.";
        const result = heuristicBehavioralEval(answer);
        expect(result.score).toBeGreaterThan(3.0); // 2.0 base + 1.0 for length > 50 + keywords
    });

    it('should increase score for STAR method keywords', () => {
        const answer = "Situation: a problem. Action: I did a thing. Result: it was fixed.";
        const result = heuristicBehavioralEval(answer);
        // 2.0 base + 0.5 situation + 0.5 action + 0.5 result
        expect(result.score).toBe(3.5);
    });

    it('should combine scores for length and keywords, capped at 5.0', () => {
        const answer = "The project situation involved a critical bug in production. The action I personally led involved debugging the code and deploying a hotfix within the hour. The final result was that the system was restored with minimal downtime, preventing significant revenue loss for the company and also improving the team's response protocol.";
        const result = heuristicBehavioralEval(answer);
        // 2.0 base + 1.0 (len>50) + 0.5 (situation) + 0.5 (action) + 0.5 (result) = 4.5
        expect(result.score).toBe(4.5);
    });
});

describe('heuristicTheoryEval', () => {

    it('should give a baseline score for a very short answer', () => {
        const answer = "It's a concept.";
        const result = heuristicTheoryEval(answer, "Ideal answer starts here.");
        expect(result.score).toBe(2.0);
    });

    it('should increase score for answers longer than 30 words', () => {
        const answer = "This is a moderately detailed answer that is definitely longer than thirty words, which should be enough to trigger the first tier of the length-based score increase for this particular test case.";
        const result = heuristicTheoryEval(answer, "Ideal answer.");
        expect(result.score).toBe(3.0); // 2.0 base + 1.0 for length > 30
    });

    it('should increase score if the answer includes the first word of the ideal answer', () => {
        const idealAnswer = "SQL is a database language.";
        const userAnswer = "Well, SQL is used for databases.";
        const result = heuristicTheoryEval(userAnswer, idealAnswer);
        // 2.0 base + 1.0 for including "SQL"
        expect(result.score).toBe(3.0);
    });
});

describe('heuristicCodingEval', () => {

    it('should give a baseline score for a non-code answer', () => {
        const code = "I would solve this by using a loop.";
        const result = heuristicCodingEval(code);
        expect(result.score).toBe(2.0);
    });

    it('should increase score for containing a function keyword', () => {
        const code = "function solve() {}";
        const result = heuristicCodingEval(code);
        expect(result.score).toBe(3.0); // 2.0 base + 1.0 for "function"
    });

    it('should increase score for containing loops and comments', () => {
        const code = `
            // This is my solution
            for (let i = 0; i < 10; i++) {}
        `;
        const result = heuristicCodingEval(code);
        // 2.0 base + 0.5 for loop + 0.5 for comment
        expect(result.score).toBe(3.0);
    });

    it('should correctly sum up all keyword scores', () => {
        const code = `
            // My function to solve the problem
            function solve(arr) {
                for (let i of arr) {
                    // do something
                }
                return true;
            }
        `;
        const result = heuristicCodingEval(code);
        // 2.0 base + 1.0 (function) + 0.5 (return) + 0.5 (for) + 0.5 (comment) = 4.5
        expect(result.score).toBe(4.5);
    });
});