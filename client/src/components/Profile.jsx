import { useState, useEffect } from 'react';
import { API_URL } from '../config';

/**
 * Profile component displays:
 * - Player stats (rank, wins, scores)
 * - Match history (last 10 games)
 * - No editing or settings (MVP only)
 */
function Profile({ playerId, onBack, onUsernameUpdate }) {
  const [profile, setProfile] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Fetch profile data on mount
  useEffect(() => {
    if (playerId) {
      fetchProfile();
    }
  }, [playerId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/profile/${playerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load profile');
      }

      setProfile(data.profile);
      setMatchHistory(data.matchHistory);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Handle username edit button click
  const handleEditClick = () => {
    setNewUsername(profile.username);
    setUsernameError('');
    setIsEditingUsername(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditingUsername(false);
    setNewUsername('');
    setUsernameError('');
  };

  // Handle save username
  const handleSaveUsername = async () => {
    // Validate username
    if (!newUsername.trim()) {
      setUsernameError('Username cannot be empty');
      return;
    }

    if (newUsername.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (newUsername.trim().length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return;
    }

    try {
      setIsSavingUsername(true);
      setUsernameError('');

      const response = await fetch(`${API_URL}/api/profile/${playerId}/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update username');
      }

      // Update local profile state
      setProfile({ ...profile, username: newUsername.trim() });

      // Update localStorage
      localStorage.setItem('bughunt_username', newUsername.trim());

      // Notify parent component if callback provided
      if (onUsernameUpdate) {
        onUsernameUpdate(newUsername.trim());
      }

      // Exit edit mode
      setIsEditingUsername(false);
      setNewUsername('');
    } catch (err) {
      console.error('Error updating username:', err);
      setUsernameError(err.message);
    } finally {
      setIsSavingUsername(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get placement emoji
  const getPlacementBadge = (placement) => {
    switch (placement) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${placement}`;
    }
  };

  // Get rank emoji
  const getRankEmoji = (rankBadge) => {
    switch (rankBadge) {
      case 'Staff Engineer': return '🌟';
      case 'Senior Engineer': return '⭐';
      case 'Mid-Level Engineer': return '💫';
      case 'Junior Engineer': return '✨';
      case 'Intern': return '🔰';
      default: return '👤';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="profile">
        <div className="profile-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="profile">
        <div className="profile-container">
          <div className="error-message">{error}</div>
          <button onClick={onBack} className="btn btn-secondary">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // No profile
  if (!profile) {
    return (
      <div className="profile">
        <div className="profile-container">
          <p>Profile not found</p>
          <button onClick={onBack} className="btn btn-secondary">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <h1 className="profile-title">Player Profile</h1>
        </div>

        {/* Player Info Card */}
        <div className="profile-card">
          <div className="profile-player-info">
            <div className="rank-badge-large">
              {getRankEmoji(profile.rankBadge)}
            </div>
            <div className="player-details">
              {!isEditingUsername ? (
                <div className="username-display">
                  <h2 className="player-username">{profile.username}</h2>
                  <button onClick={handleEditClick} className="edit-username-btn" title="Edit username">
                    ✏️ Edit
                  </button>
                </div>
              ) : (
                <div className="username-edit">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    maxLength={20}
                    className="username-input-edit"
                    placeholder="Enter new username"
                    autoFocus
                  />
                  {usernameError && <div className="error-message-small">{usernameError}</div>}
                  <div className="username-edit-actions">
                    <button
                      onClick={handleSaveUsername}
                      disabled={isSavingUsername}
                      className="btn-save-username"
                    >
                      {isSavingUsername ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSavingUsername}
                      className="btn-cancel-username"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="rank-label">{profile.rankBadge}</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="profile-stats-grid">
            <div className="profile-stat-card">
              <div className="stat-value">{profile.totalMatches}</div>
              <div className="stat-label">Total Matches</div>
            </div>

            <div className="profile-stat-card">
              <div className="stat-value">{profile.wins}</div>
              <div className="stat-label">Wins</div>
            </div>

            <div className="profile-stat-card">
              <div className="stat-value">{profile.totalScore.toLocaleString()}</div>
              <div className="stat-label">Total Score</div>
            </div>

            <div className="profile-stat-card">
              <div className="stat-value">{profile.bestScore}</div>
              <div className="stat-label">Best Score</div>
            </div>

            <div className="profile-stat-card">
              <div className="stat-value">{Math.round(profile.avgScore)}</div>
              <div className="stat-label">Avg Score</div>
            </div>

            <div className="profile-stat-card">
              <div className="stat-value">
                {profile.totalMatches > 0
                  ? `${Math.round((profile.wins / profile.totalMatches) * 100)}%`
                  : '0%'}
              </div>
              <div className="stat-label">Win Rate</div>
            </div>
          </div>

          {/* Last Played */}
          <div className="profile-footer">
            <span className="last-played">
              Last played: {formatDate(profile.lastPlayedAt)}
            </span>
          </div>
        </div>

        {/* Match History */}
        <div className="match-history-section">
          <h3 className="section-title">Recent Match History</h3>

          {matchHistory.length === 0 ? (
            <div className="empty-history">
              <p>No matches played yet</p>
              <p className="empty-subtext">Play multiplayer to build your history!</p>
            </div>
          ) : (
            <div className="match-history-list">
              {matchHistory.map((match, index) => (
                <div key={match.matchId} className="match-history-item">
                  <div className="match-placement">
                    <span className="placement-badge">
                      {getPlacementBadge(match.placement)}
                    </span>
                  </div>

                  <div className="match-details">
                    <div className="match-score">{match.score} points</div>
                    <div className="match-meta">
                      {match.totalPlayers} players • {formatDate(match.playedAt)}
                    </div>
                  </div>

                  <div className="match-result">
                    {match.placement === 1 && <span className="win-badge">Victory</span>}
                    {match.placement > 1 && <span className="place-badge">#{match.placement}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
