import { useState, useEffect } from 'react';
import { joinQueue, leaveQueue, onQueueJoined } from '../utils/socket';
import StripePayment from './StripePayment';
import GameSettings from './GameSettings';
import { API_URL } from '../config';

/**
 * Lobby component handles:
 * 1. Mode selection (Practice vs Multiplayer)
 * 2. Username entry
 * 3. Joining matchmaking queue
 * 4. Waiting for match
 * 5. Match found notification
 */
function Lobby({
  gameState,
  username,
  setUsername,
  setGameState,
  queuePosition,
  playersWaiting,
  setQueuePosition,
  setPlayersWaiting,
  players,
  onModeSelect,
  gameMode,
  profileToken,
  playerId,
  onPaymentComplete,
  gameSettings,
  setGameSettings
}) {
  const [error, setError] = useState('');
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [languageMetadata, setLanguageMetadata] = useState([]);
  const [difficultyMetadata, setDifficultyMetadata] = useState([]);

  // Fetch metadata for displaying icons
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`${API_URL}/api/game/settings`);
        const data = await response.json();
        if (data.success) {
          setLanguageMetadata(data.languages);
          setDifficultyMetadata(data.difficulties);
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Handle settings confirmation
  const handleSettingsConfirm = (settings) => {
    setGameSettings(settings);
    setGameState('username');
  };

  // Handle username submission
  const handleJoinQueue = (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setError('');

    // Check if practice mode
    if (gameMode === 'practice') {
      // Go directly to practice game with settings
      setGameState('practice-playing');
    } else {
      // Check if user has paid for multiplayer
      if (!profileToken) {
        // Free user - show payment gate
        setGameState('payment-gate');
        return;
      }

      // Paid user - proceed to matchmaking
      // Listen for queue confirmation
      onQueueJoined((data) => {
        console.log('Queue joined:', data);
        setQueuePosition(data.position);
        setPlayersWaiting(data.playersWaiting);
        setGameState('lobby');
      });

      // Emit join queue event with profileToken, playerId, and preferences
      joinQueue(username.trim(), profileToken, playerId, gameSettings);
    }
  };

  // Handle leaving queue
  const handleLeaveQueue = () => {
    leaveQueue();
    setGameState('username');
    setQueuePosition(null);
    setPlayersWaiting(0);
  };

  return (
    <div className="lobby">
      {/* Mode Selection Screen */}
      {gameState === 'mode-select' && (
        <div className="lobby-card">
          <h2>🐛 BugHunt Live</h2>
          <p className="lobby-subtitle">Choose your game mode</p>

          <div className="mode-selection">
            <button
              className="mode-card practice-mode"
              onClick={() => {
                onModeSelect('practice');
                setGameState('settings');
              }}
            >
              <div>
                <div className="mode-icon">🎯</div>
                <h3>Practice Mode</h3>
                <p className="mode-description">Solo play, sharpen your skills</p>
              </div>
              <ul className="mode-features">
                <li>No waiting for players</li>
                <li>Multiple languages</li>
                <li>Track your score</li>
                <li>Perfect for learning</li>
              </ul>
            </button>

            <button
              className="mode-card multiplayer-mode"
              onClick={() => {
                onModeSelect('multiplayer');
                setGameState('settings');
              }}
            >
              <div>
                <div className="mode-icon">⚔️</div>
                <h3>Multiplayer</h3>
                <p className="mode-description">Compete against other players</p>
              </div>
              <ul className="mode-features">
                <li>2-4 players per match</li>
                <li>Real-time competition</li>
                <li>Global leaderboard</li>
                <li>Test your speed</li>
              </ul>
            </button>
          </div>
        </div>
      )}

      {/* Game Settings Screen */}
      {gameState === 'settings' && (
        <GameSettings
          onConfirm={handleSettingsConfirm}
          onBack={() => setGameState('mode-select')}
          initialSettings={gameSettings}
        />
      )}

      {/* Username Entry Screen */}
      {gameState === 'username' && (
        <div className="lobby-card">
          <h2>{gameMode === 'practice' ? 'Practice Mode' : 'Enter the Arena'}</h2>
          <p className="lobby-subtitle">{gameMode === 'practice' ? 'Sharpen your bug-hunting skills' : 'Choose your fighter name'}</p>

          {/* Show selected settings */}
          <div className="selected-settings">
            <span className="setting-badge">
              {(() => {
                const lang = languageMetadata.find(l => l.id === gameSettings.language);
                if (lang) {
                  return (
                    <>
                      <img src={`/${lang.icon}`} alt={lang.displayName} className="setting-badge-icon" />
                      <span>{lang.displayName}</span>
                    </>
                  );
                }
                return gameSettings.language;
              })()}
            </span>
            <span className="setting-badge">
              {(() => {
                const diff = difficultyMetadata.find(d => d.id === gameSettings.difficulty);
                if (diff) {
                  return (
                    <>
                      <span className="setting-badge-emoji">{diff.icon}</span>
                      <span>{diff.name}</span>
                    </>
                  );
                }
                return gameSettings.difficulty;
              })()}
            </span>
            <button onClick={() => setGameState('settings')} className="btn-change-settings">
              Change
            </button>
          </div>

          <form onSubmit={handleJoinQueue} className="username-form">
            <input
              type="text"
              placeholder="Enter username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              className="username-input"
              autoFocus
            />

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn btn-primary">
              {gameMode === 'practice' ? 'Start Practice' : 'Join Matchmaking'}
            </button>

            <button
              type="button"
              onClick={() => setGameState('mode-select')}
              className="btn btn-secondary"
            >
              ← Back
            </button>
          </form>

          <div className="lobby-info">
            {gameMode === 'practice' ? (
              <>
                <p>🎯 Solo play mode</p>
                <p>🐛 5 questions per game</p>
                <p>⏱️ {gameSettings.difficulty === 'easy' ? '60' : gameSettings.difficulty === 'medium' ? '30' : '15'} seconds per question</p>
                <p>🏆 100 points per correct answer</p>
              </>
            ) : (
              <>
                <p>🎮 2-4 players per match</p>
                <p>🐛 5 questions per game</p>
                <p>⏱️ {gameSettings.difficulty === 'easy' ? '60' : gameSettings.difficulty === 'medium' ? '30' : '15'} seconds per question</p>
                <p>🏆 100 points per correct answer</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Waiting in Queue */}
      {gameState === 'lobby' && (
        <div className="lobby-card">
          <h2>Finding Players...</h2>
          <div className="queue-status">
            <div className="spinner"></div>
            <p className="queue-text">
              Searching for opponents
            </p>
            <div className="queue-stats">
              <span>{playersWaiting} {playersWaiting === 1 ? 'player' : 'players'} waiting</span>
            </div>
          </div>

          <button onClick={handleLeaveQueue} className="btn btn-secondary">
            Leave Queue
          </button>
        </div>
      )}

      {/* Match Found - Waiting for Game Start */}
      {gameState === 'waiting' && (
        <div className="lobby-card">
          <h2>Match Found!</h2>
          <div className="match-found">
            <p className="match-text">Get ready to hunt bugs...</p>

            <div className="players-list">
              <h3>Players in this match:</h3>
              {players.map((player, index) => (
                <div key={player.id} className="player-item">
                  <span className="player-number">#{index + 1}</span>
                  <span className="player-name">{player.username}</span>
                </div>
              ))}
            </div>

            <div className="countdown-notice">
              <p>Game starting soon...</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Gate - Unlock Multiplayer */}
      {gameState === 'payment-gate' && (
        <div className="lobby-card payment-gate">
          <h2>🔓 Unlock Multiplayer Profiles</h2>
          <p className="lobby-subtitle">Get persistent stats, match history, and rank progression</p>

          <div className="payment-features">
            <h3>What you get:</h3>
            <ul>
              <li>Persistent player profile across sessions</li>
              <li>Match history (last 10 games)</li>
              <li>Rank badges (Intern → Staff Engineer)</li>
              <li>Stats tracking (wins, avg score, best score)</li>
              <li>Global leaderboard placement</li>
            </ul>
          </div>

          <div className="payment-info">
            <p className="price-tag">One-time payment: $19.00</p>
            <p className="payment-note">Practice mode remains free forever!</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          {!showStripeCheckout ? (
            <div className="payment-actions">
              <button
                onClick={() => setShowStripeCheckout(true)}
                className="btn btn-primary"
              >
                Pay with Card
              </button>
              <button
                onClick={() => setGameState('mode-select')}
                className="btn btn-secondary"
              >
                ← Back to Menu
              </button>
            </div>
          ) : (
            <div className="stripe-checkout-wrapper">
              <StripePayment
                playerId={playerId}
                onSuccess={(profileToken) => {
                  onPaymentComplete(profileToken);
                  alert('Payment successful! You now have access to multiplayer profiles.');
                  setGameState('username');
                }}
                onCancel={() => setShowStripeCheckout(false)}
              />
            </div>
          )}

          {!showStripeCheckout && (
            <p className="payment-disclaimer">
              💳 Secure payment processing powered by Stripe
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Lobby;
