const questions = require('../data/questions.json');

class QuestionService {
  constructor() {
    this.questionPool = questions;
  }

  // Get a random set of questions for a match
  getQuestionsForMatch(count = 5) {
    // Shuffle and take first N questions
    const shuffled = [...this.questionPool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Validate answer and calculate score
  checkAnswer(questionId, answerId) {
    const question = this.questionPool.find(q => q.id === questionId);
    if (!question) {
      return { isValid: false, error: 'Question not found' };
    }

    const isCorrect = question.correctAnswer === answerId;
    const basePoints = 100;

    return {
      isValid: true,
      isCorrect,
      points: isCorrect ? basePoints : 0,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    };
  }

  // Get question data without correct answer (for client)
  getQuestionForClient(questionId) {
    const question = this.questionPool.find(q => q.id === questionId);
    if (!question) {
      return null;
    }

    // Return question without revealing correct answer
    return {
      id: question.id,
      code: question.code,
      question: question.question,
      choices: question.choices,
      timeLimit: 30 // seconds
    };
  }

  // Get total available questions
  getQuestionCount() {
    return this.questionPool.length;
  }
}

// Singleton instance
module.exports = new QuestionService();
