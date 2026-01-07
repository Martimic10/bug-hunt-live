import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import '../styles/GameSettings.css';

function GameSettings({ onConfirm, onBack, initialSettings = {} }) {
  const [languages, setLanguages] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(initialSettings.language || 'javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState(initialSettings.difficulty || 'medium');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/game/settings`);
      const data = await response.json();

      if (data.success) {
        setLanguages(data.languages);
        setDifficulties(data.difficulties);
      } else {
        setError('Failed to load settings');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      language: selectedLanguage,
      difficulty: selectedDifficulty
    });
  };

  if (loading) {
    return (
      <div className="game-settings-container">
        <div className="game-settings-card">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-settings-container">
        <div className="game-settings-card">
          <div className="error-message">{error}</div>
          <button onClick={onBack} className="btn btn-secondary">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-settings-container">
      <div className="game-settings-card">
        <h2>Game Settings</h2>
        <p className="settings-subtitle">Choose your challenge</p>

        <div className="setting-group">
          <label>Programming Language</label>
          <div className="language-options">
            {languages.map(lang => (
              <button
                key={lang.id}
                className={`language-option ${selectedLanguage === lang.id ? 'selected' : ''}`}
                onClick={() => setSelectedLanguage(lang.id)}
              >
                <img
                  src={`/${lang.icon}`}
                  alt={lang.displayName}
                  className="language-icon"
                  onError={(e) => {
                    console.error(`Failed to load image: /${lang.icon}`);
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <span
                  className="language-icon-fallback"
                  style={{ display: 'none' }}
                >
                  {lang.id === 'javascript' ? '🟨' :
                   lang.id === 'python' ? '🐍' :
                   lang.id === 'java' ? '☕' :
                   lang.id === 'cpp' ? '⚙️' : '💻'}
                </span>
                <div className="language-info">
                  <span className="language-name">{lang.displayName}</span>
                  <span className="question-count">{lang.questionCount} questions</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="setting-group">
          <label>Difficulty / Time Limit</label>
          <div className="difficulty-options">
            {difficulties.map(diff => (
              <button
                key={diff.id}
                className={`difficulty-option ${selectedDifficulty === diff.id ? 'selected' : ''}`}
                onClick={() => setSelectedDifficulty(diff.id)}
              >
                <span className="difficulty-icon">{diff.icon}</span>
                <div className="difficulty-info">
                  <span className="difficulty-name">{diff.name}</span>
                  <span className="time-limit">{diff.timeLimit}s per question</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleConfirm}>
            Start Game →
          </button>
          <button onClick={onBack} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSettings;
