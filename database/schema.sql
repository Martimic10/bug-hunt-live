-- BugHunt Live Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Players table (guest sessions)
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'in_progress', 'completed')),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Match participants
CREATE TABLE match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    final_score INTEGER DEFAULT 0,
    rank INTEGER,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- Question responses (optional - for analytics)
CREATE TABLE question_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    answer_id VARCHAR(10) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_ended_at ON matches(ended_at);
CREATE INDEX idx_match_players_match ON match_players(match_id);
CREATE INDEX idx_match_players_player ON match_players(player_id);
CREATE INDEX idx_match_players_score ON match_players(final_score DESC);
CREATE INDEX idx_question_responses_match ON question_responses(match_id);
CREATE INDEX idx_question_responses_player ON question_responses(player_id);

-- Leaderboard view for aggregated player stats
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_stats AS
SELECT
    username,
    COUNT(DISTINCT match_id) as total_matches,
    SUM(final_score) as total_score,
    AVG(final_score) as avg_score,
    MAX(final_score) as best_score,
    COUNT(CASE WHEN rank = 1 THEN 1 END) as wins,
    MAX(matches.ended_at) as last_played
FROM match_players
JOIN matches ON match_players.match_id = matches.id
WHERE matches.status = 'completed'
GROUP BY username;

-- Index on leaderboard stats
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_score ON leaderboard_stats(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_username ON leaderboard_stats(username);

-- Function to refresh leaderboard stats
CREATE OR REPLACE FUNCTION refresh_leaderboard() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Sample queries:

-- Top 50 players by total score (primary leaderboard)
-- SELECT username, total_matches, total_score, wins, best_score, last_played
-- FROM leaderboard_stats
-- ORDER BY total_score DESC
-- LIMIT 50;

-- Top 50 players by best single game score
-- SELECT username, final_score, matches.ended_at
-- FROM match_players
-- JOIN matches ON match_players.match_id = matches.id
-- WHERE matches.status = 'completed'
-- ORDER BY final_score DESC, matches.ended_at DESC
-- LIMIT 50;

-- Player match history
-- SELECT matches.id, final_score, rank, matches.ended_at
-- FROM match_players
-- JOIN matches ON match_players.match_id = matches.id
-- WHERE player_id = 'uuid-here'
-- ORDER BY matches.ended_at DESC;
