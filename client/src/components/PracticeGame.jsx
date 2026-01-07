import { useState, useEffect } from 'react';
import { API_URL } from '../config';

/**
 * Practice Mode - Single player game
 * No Socket.io, all state managed locally
 * Fetches questions from API, tracks score client-side
 */
function PracticeGame({ username, onGameEnd }) {
  // Practice game state
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const questionNumber = currentQuestionIndex + 1;

  // Fetch questions on mount
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!currentQuestion || answerSubmitted || loading) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, answerSubmitted, loading]);

  // Fetch questions from API
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/practice/questions?count=5`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch questions');
      }

      setQuestions(data.questions);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Handle answer selection
  const handleAnswerClick = (choiceId) => {
    if (answerSubmitted || timeRemaining === 0) return;
    setSelectedAnswer(choiceId);
  };

  // Submit answer to backend for checking
  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || answerSubmitted) return;

    setAnswerSubmitted(true);

    try {
      const response = await fetch(`${API_URL}/api/practice/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerId: selectedAnswer
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to check answer');
      }

      // Update score and feedback
      setAnswerFeedback({
        correct: data.correct,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation
      });

      if (data.correct) {
        setScore(score + data.points);
        setCorrectAnswers(correctAnswers + 1);
      }

      // Move to next question after delay
      setTimeout(() => {
        nextQuestion();
      }, 3000);
    } catch (err) {
      console.error('Error checking answer:', err);
      setError(err.message);
    }
  };

  // Handle timeout (no answer submitted)
  const handleTimeout = () => {
    if (answerSubmitted) return;

    // Auto-submit or move to next
    setTimeout(() => {
      nextQuestion();
    }, 2000);
  };

  // Move to next question or end game
  const nextQuestion = () => {
    if (currentQuestionIndex + 1 >= totalQuestions) {
      // Game over
      endGame();
    } else {
      // Next question
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeRemaining(30);
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setAnswerFeedback(null);
    }
  };

  // End the game
  const endGame = () => {
    onGameEnd({
      score,
      correctAnswers,
      totalQuestions,
      isPractice: true
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="game-loading">
        <div className="spinner"></div>
        <p>Loading practice questions...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="game-loading">
        <p className="error-message">Error: {error}</p>
        <button onClick={fetchQuestions} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  // No questions
  if (!currentQuestion) {
    return (
      <div className="game-loading">
        <p>No questions available</p>
      </div>
    );
  }

  return (
    <div className="game">
      <div className="game-container">
        <div className="game-main">
          {/* Practice Mode Badge */}
          <div className="practice-badge">
            🎯 Practice Mode - Solo Play
          </div>

          {/* Question Header */}
          <div className="question-header">
            <div className="question-progress">
              Question {questionNumber} of {totalQuestions}
            </div>
            <div className={`timer ${timeRemaining <= 5 ? 'timer-warning' : ''}`}>
              ⏱️ {timeRemaining}s
            </div>
          </div>

          {/* Code Snippet */}
          <div className="code-container">
            <div className="code-label">Find the bug in this code:</div>
            <pre className="code-block">
              <code>{currentQuestion.code}</code>
            </pre>
          </div>

          {/* Question Text */}
          <div className="question-text">
            <h3>{currentQuestion.question}</h3>
          </div>

          {/* Answer Choices */}
          <div className="choices-container">
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedAnswer === choice.id;
              const isCorrect = answerFeedback && choice.id === answerFeedback.correctAnswer;
              const isWrong = answerFeedback && isSelected && !answerFeedback.correct;

              let choiceClass = 'choice';
              if (isSelected && !answerSubmitted) choiceClass += ' selected';
              if (answerSubmitted && isCorrect) choiceClass += ' correct';
              if (answerSubmitted && isWrong) choiceClass += ' wrong';

              return (
                <button
                  key={choice.id}
                  className={choiceClass}
                  onClick={() => handleAnswerClick(choice.id)}
                  disabled={answerSubmitted || timeRemaining === 0}
                >
                  <span className="choice-id">{choice.id.toUpperCase()}.</span>
                  <span className="choice-text">{choice.text}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!answerSubmitted && (
            <button
              className="btn btn-submit"
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || timeRemaining === 0}
            >
              {timeRemaining === 0 ? 'Time Up!' : 'Submit Answer'}
            </button>
          )}

          {/* Answer Feedback */}
          {answerFeedback && (
            <div className={`feedback ${answerFeedback.correct ? 'feedback-correct' : 'feedback-wrong'}`}>
              <div className="feedback-result">
                {answerFeedback.correct ? '✅ Correct!' : '❌ Incorrect'}
              </div>
              <div className="feedback-explanation">
                <strong>Explanation:</strong> {answerFeedback.explanation}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Score Display */}
        <div className="game-sidebar">
          <div className="scoreboard">
            <h3 className="scoreboard-title">📊 Your Progress</h3>
            <div className="practice-stats">
              <div className="stat-row">
                <span className="stat-label">Score:</span>
                <span className="stat-value">{score}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Correct:</span>
                <span className="stat-value">{correctAnswers}/{questionNumber}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticeGame;
