// /utils/questionBank.js
// NEW FILE - A structured bank of questions by type and difficulty

const questionBank = {
  behavioral: {
    easy: [
      { text: "Tell me about yourself." },
      { text: "What are your biggest strengths?" },
    ],
    medium: [
      { text: "Tell me about a time you had to work with a difficult coworker." },
      { text: "Describe a project you are particularly proud of." },
    ],
    hard: [
      { text: "Describe a time you failed. What did you learn from it?" },
      { text: "Tell me about a time you had to make a critical decision with limited information." },
    ],
  },
  coding: {
    easy: [
      { text: "Write a function that returns the largest number in an array." , language_id: 93},
    ],
    medium: [
      { text: "Write a function to check if a string is a palindrome.", language_id: 93 },
    ],
    hard: [
      { text: "Given a sorted array of integers, write a function that finds the first and last position of a given target value (Binary Search).", language_id: 93 },
    ],
  },
  theory: {
    easy: [
      { text: "What is an API?" },
    ],
    medium: [
      { text: "Explain the difference between SQL and NoSQL databases." },
    ],
    hard: [
      { text: "What is polymorphism in object-oriented programming? Provide an example." },
    ],
  }
};

module.exports = questionBank;