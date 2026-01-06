/**
 * GameOver component displays final results
 * Shows winner, final leaderboard, and option to play again
 * Works for both Practice and Multiplayer modes
 */
function GameOver({ finalScores, winner, username, resetToLobby, isPractice }) {
  // Sort final scores
  const sortedScores = [...finalScores].sort((a, b) => b.score - a.score);

  // Find current player's rank
  const currentPlayerIndex = sortedScores.findIndex(
    (player) => player.username === username
  );
  const currentPlayerRank = currentPlayerIndex + 1;
  const currentPlayerScore = sortedScores[currentPlayerIndex]?.score || 0;

  return (
    <div className="game-over">
      <div className="game-over-card">
        {/* Practice Mode Badge */}
        {isPractice && (
          <div className="practice-badge">
            🎯 Practice Mode Complete
          </div>
        )}

        {/* Winner Announcement */}
        <div className="winner-section">
          <h1 className="game-over-title">{isPractice ? 'Practice Complete!' : 'Game Over!'}</h1>
          <div className="winner-announcement">
            <div className="trophy">{isPractice ? '🎯' : '🏆'}</div>
            <h2 className="winner-name">{winner.username}</h2>
            <p className="winner-label">{isPractice ? 'finished with' : 'is the winner!'}</p>
            <p className="winner-score">{winner.score} points</p>
          </div>
        </div>

        {/* Current Player Stats */}
        <div className="player-stats">
          <h3>Your Performance</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">#{currentPlayerRank}</div>
              <div className="stat-label">Rank</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{currentPlayerScore}</div>
              <div className="stat-label">Score</div>
            </div>
          </div>
        </div>

        {/* Final Leaderboard */}
        <div className="final-leaderboard">
          <h3>Final Standings</h3>
          <div className="leaderboard-list">
            {sortedScores.map((player, index) => {
              const rank = index + 1;
              const isCurrentPlayer = player.username === username;

              return (
                <div
                  key={player.playerId}
                  className={`leaderboard-row ${isCurrentPlayer ? 'current-player' : ''}`}
                >
                  <div className="rank-badge">
                    {rank === 1 && '🥇'}
                    {rank === 2 && '🥈'}
                    {rank === 3 && '🥉'}
                    {rank > 3 && `#${rank}`}
                  </div>

                  <div className="player-name">
                    {player.username}
                    {isCurrentPlayer && <span className="you-badge">YOU</span>}
                  </div>

                  <div className="player-final-score">{player.score} pts</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multiplayer Upgrade Prompt for Practice Mode */}
        {isPractice && (
          <div className="upgrade-prompt">
            <p>🏆 Ready to compete against real players?</p>
            <p className="upgrade-subtext">Try Multiplayer mode for leaderboard rankings!</p>
          </div>
        )}

        {/* Play Again Button */}
        <button onClick={resetToLobby} className="btn btn-primary btn-play-again">
          {isPractice ? 'Back to Menu' : 'Play Again'}
        </button>
      </div>
    </div>
  );
}

export default GameOver;
