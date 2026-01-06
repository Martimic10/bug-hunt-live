/**
 * Scoreboard component displays live player rankings during game
 * Updates after each question when backend sends 'round_scores' event
 */
function Scoreboard({ scores, username }) {
  // Sort scores by score descending
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="scoreboard">
      <h3 className="scoreboard-title">🏆 Live Scores</h3>

      {sortedScores.length === 0 ? (
        <div className="scoreboard-empty">
          <p>Scores will appear after first question</p>
        </div>
      ) : (
        <div className="scoreboard-list">
          {sortedScores.map((player, index) => {
            const isCurrentPlayer = player.username === username;
            const rank = index + 1;

            return (
              <div
                key={player.playerId}
                className={`scoreboard-player ${isCurrentPlayer ? 'current-player' : ''} ${
                  rank === 1 ? 'rank-1' : ''
                }`}
              >
                <div className="player-rank">
                  {rank === 1 && '👑'}
                  {rank === 2 && '🥈'}
                  {rank === 3 && '🥉'}
                  {rank > 3 && `#${rank}`}
                </div>

                <div className="player-info">
                  <div className="player-username">
                    {player.username}
                    {isCurrentPlayer && <span className="you-badge">YOU</span>}
                  </div>
                </div>

                <div className="player-score">{player.score}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Scoreboard;
