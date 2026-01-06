import { useState, useEffect } from 'react';
import { submitAnswer } from '../utils/socket';
import Scoreboard from './Scoreboard';

/**
 * Game component handles active gameplay:
 * 1. Display current question with code snippet
 * 2. Show multiple choice answers
 * 3. Handle answer selection and submission
 * 4. Show countdown timer
 * 5. Display answer feedback
 * 6. Show live scoreboard
 */
function Game({
  currentQuestion,
  questionNumber,
  totalQuestions,
  questionTimeLimit,
  selectedAnswer,
  setSelectedAnswer,
  answerSubmitted,
  setAnswerSubmitted,
  answerFeedback,
  scores,
  username
}) {
  const [timeRemaining, setTimeRemaining] = useState(questionTimeLimit);

  // Reset timer when new question arrives
  useEffect(() => {
    if (currentQuestion) {
      setTimeRemaining(questionTimeLimit);
    }
  }, [currentQuestion, questionTimeLimit]);

  // Countdown timer
  useEffect(() => {
    if (!currentQuestion || answerSubmitted) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, answerSubmitted]);

  // Handle answer selection
  const handleAnswerClick = (choiceId) => {
    if (answerSubmitted || timeRemaining === 0) return;
    setSelectedAnswer(choiceId);
  };

  // Handle answer submission
  const handleSubmitAnswer = () => {
    if (!selectedAnswer || answerSubmitted) return;

    setAnswerSubmitted(true);
    submitAnswer(selectedAnswer, currentQuestion.id);
  };

  // Show loading state if no question yet
  if (!currentQuestion) {
    return (
      <div className="game-loading">
        <div className="spinner"></div>
        <p>Loading question...</p>
      </div>
    );
  }

  return (
    <div className="game">
      <div className="game-container">
        {/* Left side - Question and Answers */}
        <div className="game-main">
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

        {/* Right side - Scoreboard */}
        <div className="game-sidebar">
          <Scoreboard scores={scores} username={username} />
        </div>
      </div>
    </div>
  );
}

export default Game;
