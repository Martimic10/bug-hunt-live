import { useState, useEffect } from 'react';
import {
  connectSocket,
  disconnectSocket,
  onConnect,
  onDisconnect,
  onQueueJoined,
  onMatchFound,
  onGameStart,
  onQuestion,
  onAnswerResult,
  onRoundScores,
  onGameEnd,
  onPlayerLeft,
  onError,
  removeAllListeners
} from './utils/socket';
import Lobby from './components/Lobby';
import Game from './components/Game';
import PracticeGame from './components/PracticeGame';
import GameOver from './components/GameOver';
import Profile from './components/Profile';
import './styles/App.css';

/**
 * Game states:
 * - 'mode-select': Choose Practice or Multiplayer
 * - 'username': Entering username
 * - 'lobby': In matchmaking queue
 * - 'waiting': Match found, waiting for game start
 * - 'playing': Active game (multiplayer)
 * - 'practice-playing': Active game (practice mode)
 * - 'game-over': Game ended
 * - 'profile': Viewing player profile
 */

function App() {
  // Global state
  const [gameState, setGameState] = useState('mode-select'); // Current screen
  const [previousGameState, setPreviousGameState] = useState(null); // State before viewing profile
  const [gameMode, setGameMode] = useState(null); // 'practice' or 'multiplayer'
  const [username, setUsername] = useState(''); // Player username
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Player profile state (anonymous identity)
  const [playerId, setPlayerId] = useState(null);
  const [profileToken, setProfileToken] = useState(null);

  // Lobby state
  const [queuePosition, setQueuePosition] = useState(null);
  const [playersWaiting, setPlayersWaiting] = useState(0);

  // Match state
  const [matchId, setMatchId] = useState(null);
  const [players, setPlayers] = useState([]);

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState(null);

  // Scoreboard state
  const [scores, setScores] = useState([]);

  // Game over state
  const [finalScores, setFinalScores] = useState([]);
  const [winner, setWinner] = useState(null);

  // Generate or restore player_id on mount
  useEffect(() => {
    const initializePlayer = async () => {
      let savedPlayerId = localStorage.getItem('bughunt_player_id');
      const savedToken = localStorage.getItem('bughunt_profile_token');
      const savedUsername = localStorage.getItem('bughunt_username');

      // Generate player_id if doesn't exist (anonymous identity)
      if (!savedPlayerId) {
        savedPlayerId = crypto.randomUUID();
        localStorage.setItem('bughunt_player_id', savedPlayerId);
        console.log('Generated new player_id:', savedPlayerId);
      }

      setPlayerId(savedPlayerId);

      // If they have a profile token (paid user), restore their profile
      if (savedToken) {
        try {
          const response = await fetch('http://localhost:3000/api/profile/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileToken: savedToken })
          });

          const data = await response.json();

          if (data.success) {
            setProfileToken(data.player.profileToken);
            setUsername(savedUsername || data.player.username);
            console.log('Paid profile restored:', data.player.username);
          } else {
            // Invalid token, clear it
            localStorage.removeItem('bughunt_profile_token');
          }
        } catch (error) {
          console.error('Failed to restore profile:', error);
        }
      }
    };

    initializePlayer();
  }, []);

  // Initialize socket connection on mount
  useEffect(() => {
    connectSocket();

    // Setup connection listeners
    onConnect(() => {
      console.log('Connected to server');
      setConnectionStatus('connected');
    });

    onDisconnect(() => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    // Setup game event listeners
    onQueueJoined((data) => {
      console.log('Queue joined:', data);

      // Save player_id (always)
      if (data.playerId) {
        localStorage.setItem('bughunt_player_id', data.playerId);
        setPlayerId(data.playerId);
      }

      // Save profile token only for paid users
      if (data.hasPaid && data.profileToken) {
        saveProfileToStorage(data.playerId, data.profileToken, username);
      }
    });

    onMatchFound((data) => {
      console.log('Match found:', data);
      setMatchId(data.matchId);
      setPlayers(data.players);
      setGameState('waiting');
    });

    onGameStart((data) => {
      console.log('Game starting:', data);
      setTotalQuestions(data.totalQuestions);
      setQuestionTimeLimit(data.questionTimeLimit);
      setGameState('playing');
    });

    onQuestion((data) => {
      console.log('New question:', data);
      setCurrentQuestion(data);
      setQuestionNumber(data.questionNumber);
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
      setAnswerFeedback(null);
    });

    onAnswerResult((data) => {
      console.log('Answer result:', data);
      setAnswerFeedback(data);
    });

    onRoundScores((data) => {
      console.log('Round scores:', data);
      setScores(data.scores);
    });

    onGameEnd((data) => {
      console.log('Game ended:', data);
      setFinalScores(data.finalScores);
      setWinner(data.winner);
      setGameState('game-over');
    });

    onPlayerLeft((data) => {
      console.log('Player left:', data);
      // Could show notification here
    });

    onError((data) => {
      console.error('Socket error:', data);
      alert(`Error: ${data.message}`);
    });

    // Cleanup on unmount
    return () => {
      removeAllListeners('connect');
      removeAllListeners('disconnect');
      removeAllListeners('match_found');
      removeAllListeners('game_start');
      removeAllListeners('question');
      removeAllListeners('answer_result');
      removeAllListeners('round_scores');
      removeAllListeners('game_end');
      removeAllListeners('player_left');
      removeAllListeners('error');
      disconnectSocket();
    };
  }, []);

  // Handle mode selection
  const handleModeSelect = (mode) => {
    setGameMode(mode);
    if (mode === 'practice') {
      setGameState('username');
    } else {
      setGameState('username');
      connectSocket();
    }
  };

  // Handle practice game end
  const handlePracticeGameEnd = (result) => {
    setFinalScores([{
      username,
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalAnswers: result.totalQuestions,
      rank: 1
    }]);
    setWinner({
      username,
      score: result.score
    });
    setGameState('game-over');
  };

  // Save profile to localStorage (called when profile is created/updated)
  const saveProfileToStorage = (id, token, name) => {
    localStorage.setItem('bughunt_player_id', id);
    localStorage.setItem('bughunt_profile_token', token);
    localStorage.setItem('bughunt_username', name);
    setPlayerId(id);
    setProfileToken(token);
  };

  // Handle payment completion
  const handlePaymentComplete = (token) => {
    saveProfileToStorage(playerId, token, username);
  };

  // View player profile (only for paid users)
  const viewProfile = () => {
    if (profileToken) {
      setPreviousGameState(gameState); // Save current state before viewing profile
      setGameState('profile');
    } else {
      alert('Unlock multiplayer to get a persistent profile! Profiles are only available for paying users.');
    }
  };

  // Back from profile to menu
  const backFromProfile = () => {
    // Return to previous state if it exists, otherwise go to mode-select
    if (previousGameState) {
      setGameState(previousGameState);
      setPreviousGameState(null);
    } else {
      setGameState('mode-select');
    }
  };

  // Handle username update from profile
  const handleUsernameUpdate = (newUsername) => {
    setUsername(newUsername);
    localStorage.setItem('bughunt_username', newUsername);
  };

  // Reset to lobby
  const resetToLobby = () => {
    setGameState('mode-select');
    setGameMode(null);
    setUsername('');
    setMatchId(null);
    setPlayers([]);
    setCurrentQuestion(null);
    setScores([]);
    setFinalScores([]);
    setWinner(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={resetToLobby} className="app-title">
          <img src="/BugHunt-Live-Picsart-BackgroundRemover.png" alt="BugHunt Live Logo" className="app-logo" />
          BugHunt Live
        </h1>
        <div className="header-actions">
          {playerId && gameState !== 'profile' && (
            <button onClick={viewProfile} className="btn-profile">
              👤 Profile
            </button>
          )}
          <div className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Lobby / Matchmaking */}
        {(gameState === 'mode-select' || gameState === 'username' || gameState === 'lobby' || gameState === 'waiting' || gameState === 'payment-gate') && (
          <Lobby
            gameState={gameState}
            username={username}
            setUsername={setUsername}
            setGameState={setGameState}
            queuePosition={queuePosition}
            playersWaiting={playersWaiting}
            setQueuePosition={setQueuePosition}
            setPlayersWaiting={setPlayersWaiting}
            players={players}
            onModeSelect={handleModeSelect}
            gameMode={gameMode}
            profileToken={profileToken}
            playerId={playerId}
            onPaymentComplete={handlePaymentComplete}
          />
        )}

        {/* Practice Game */}
        {gameState === 'practice-playing' && (
          <PracticeGame
            username={username}
            onGameEnd={handlePracticeGameEnd}
          />
        )}

        {/* Multiplayer Game */}
        {gameState === 'playing' && (
          <Game
            currentQuestion={currentQuestion}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            questionTimeLimit={questionTimeLimit}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            answerSubmitted={answerSubmitted}
            setAnswerSubmitted={setAnswerSubmitted}
            answerFeedback={answerFeedback}
            scores={scores}
            username={username}
          />
        )}

        {/* Game Over */}
        {gameState === 'game-over' && (
          <GameOver
            finalScores={finalScores}
            winner={winner}
            username={username}
            resetToLobby={resetToLobby}
            isPractice={gameMode === 'practice'}
          />
        )}

        {/* Profile */}
        {gameState === 'profile' && (
          <Profile
            playerId={playerId}
            onBack={backFromProfile}
            onUsernameUpdate={handleUsernameUpdate}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Real-time multiplayer bug hunting game</p>
      </footer>
    </div>
  );
}

export default App;
