const fs = require('fs');
const path = require('path');

class QuestionService {
  constructor() {
    this.questionsByLanguage = new Map();
    this.metadata = null;
    this.loadQuestions();
  }

  // Load all questions and metadata
  loadQuestions() {
    try {
      // Load metadata
      const metadataPath = path.join(__dirname, '../data/question-metadata.json');
      this.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Load each language's questions
      this.metadata.languages.forEach(lang => {
        if (lang.enabled) {
          const questionsPath = path.join(__dirname, `../data/questions/${lang.id}.json`);
          const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
          this.questionsByLanguage.set(lang.id, questions);
          console.log(`✓ Loaded ${questions.length} ${lang.displayName} questions`);
        }
      });
    } catch (error) {
      console.error('Error loading questions:', error);
      // Fallback to old questions.json for backward compatibility
      try {
        const oldQuestionsPath = path.join(__dirname, '../data/questions.json');
        const oldQuestions = JSON.parse(fs.readFileSync(oldQuestionsPath, 'utf8'));
        this.questionsByLanguage.set('javascript', oldQuestions);
        this.metadata = {
          languages: [{ id: 'javascript', name: 'JavaScript', displayName: 'JavaScript', icon: '🟨', enabled: true, questionCount: oldQuestions.length }],
          difficulties: [{ id: 'medium', name: 'Medium', timeLimit: 30, icon: '🟡' }]
        };
        console.log('⚠️  Loaded legacy questions.json (backward compatibility mode)');
      } catch (fallbackError) {
        console.error('Fatal error loading questions:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // Get questions for match with language filter
  getQuestionsForMatch(count = 5, language = 'javascript') {
    const questionPool = this.questionsByLanguage.get(language) || this.questionsByLanguage.get('javascript') || [];

    if (questionPool.length === 0) {
      console.warn(`No questions found for language: ${language}`);
      return [];
    }

    // Shuffle and take first N questions
    const shuffled = [...questionPool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Get available languages
  getAvailableLanguages() {
    if (!this.metadata) {
      return [{ id: 'javascript', name: 'JavaScript', displayName: 'JavaScript', icon: '🟨', enabled: true, questionCount: 20 }];
    }
    return this.metadata.languages.filter(l => l.enabled);
  }

  // Get difficulty settings
  getDifficulties() {
    if (!this.metadata) {
      return [{ id: 'medium', name: 'Medium', timeLimit: 30, icon: '🟡' }];
    }
    return this.metadata.difficulties;
  }

  // Get time limit for difficulty
  getTimeLimit(difficulty = 'medium') {
    const diff = this.getDifficulties().find(d => d.id === difficulty);
    return diff ? diff.timeLimit : 30;
  }

  // Validate answer and calculate score (with language context)
  checkAnswer(questionId, answerId, language = 'javascript') {
    const questionPool = this.questionsByLanguage.get(language) || this.questionsByLanguage.get('javascript') || [];
    const question = questionPool.find(q => q.id === questionId);

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
  getQuestionForClient(questionId, language = 'javascript') {
    const questionPool = this.questionsByLanguage.get(language) || this.questionsByLanguage.get('javascript') || [];
    const question = questionPool.find(q => q.id === questionId);

    if (!question) {
      return null;
    }

    // Return question without revealing correct answer
    return {
      id: question.id,
      code: question.code,
      question: question.question,
      choices: question.choices,
      timeLimit: 30 // Default, can be overridden by difficulty
    };
  }

  // Get total available questions for a language
  getQuestionCount(language = 'javascript') {
    const questionPool = this.questionsByLanguage.get(language) || [];
    return questionPool.length;
  }

  // Get all available languages (legacy method for compatibility)
  getAllLanguages() {
    return Array.from(this.questionsByLanguage.keys());
  }
}

// Singleton instance
module.exports = new QuestionService();
