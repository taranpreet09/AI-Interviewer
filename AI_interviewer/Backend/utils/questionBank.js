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
    medium: [
      { 
        text: "Explain the difference between SQL and NoSQL databases.",
        idealAnswer: "SQL databases are relational, use structured query language, and have a predefined schema. They are vertically scalable and good for applications requiring multi-row transactions. NoSQL databases are non-relational, have dynamic schemas, are horizontally scalable, and are great for unstructured data, large volumes, and flexible data models. Examples include key-value, document, and graph databases."
      },
    ],
    hard: [
      {
        text: "What is polymorphism in object-oriented programming? Provide an example.",
        idealAnswer: "Polymorphism, meaning 'many forms', is a core OOP concept where a single interface can represent different underlying forms (data types). It allows methods to do different things based on the object it is acting upon. A common example is a base class 'Shape' with a method 'draw()'. Subclasses like 'Circle' and 'Square' can implement 'draw()' in their own unique way. You can then call the 'draw()' method on an array of 'Shape' objects, and the correct implementation will be executed for each, enabling code flexibility and extension."
      }
    ]
  }
};

module.exports = questionBank;