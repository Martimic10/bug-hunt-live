-- Migration: Add Player Profiles and Match History
-- Purpose: Enable persistent anonymous player profiles without authentication
-- Date: 2026-01-05

-- =======================
-- 1. Extend Players Table
-- =======================
-- Add profile fields to existing players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_token VARCHAR(64) UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_matches INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_score DECIMAL(10,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rank_badge VARCHAR(20) DEFAULT 'Intern';
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index for profile_token lookups
CREATE INDEX IF NOT EXISTS idx_players_profile_token ON players(profile_token);

-- =======================
-- 2. Match History Table
-- =======================
-- Store last N matches per player with detailed stats
CREATE TABLE IF NOT EXISTS player_match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    placement INTEGER NOT NULL, -- 1st, 2nd, 3rd, 4th
    score INTEGER NOT NULL,
    total_players INTEGER NOT NULL,
    played_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, match_id)
);

-- Index for fetching player's recent matches
CREATE INDEX IF NOT EXISTS idx_player_match_history_player ON player_match_history(player_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_match_history_match ON player_match_history(match_id);

-- =======================
-- 3. Rank Badge Calculation
-- =======================
-- Function to calculate rank badge based on total score
CREATE OR REPLACE FUNCTION calculate_rank_badge(total_score INTEGER) RETURNS VARCHAR(20) AS $$
BEGIN
    -- Rank thresholds (feel free to adjust)
    IF total_score >= 5000 THEN
        RETURN 'Staff Engineer';
    ELSIF total_score >= 3000 THEN
        RETURN 'Senior Engineer';
    ELSIF total_score >= 1500 THEN
        RETURN 'Mid-Level Engineer';
    ELSIF total_score >= 500 THEN
        RETURN 'Junior Engineer';
    ELSE
        RETURN 'Intern';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =======================
-- 4. Profile Stats Update Function
-- =======================
-- Updates player profile stats after each match
CREATE OR REPLACE FUNCTION update_player_profile_stats(p_player_id UUID) RETURNS void AS $$
DECLARE
    v_total_matches INTEGER;
    v_wins INTEGER;
    v_total_score INTEGER;
    v_best_score INTEGER;
    v_avg_score DECIMAL(10,2);
    v_rank_badge VARCHAR(20);
    v_last_played TIMESTAMP;
BEGIN
    -- Calculate aggregate stats from match_players
    SELECT
        COUNT(DISTINCT match_id),
        COUNT(CASE WHEN rank = 1 THEN 1 END),
        COALESCE(SUM(final_score), 0),
        COALESCE(MAX(final_score), 0),
        COALESCE(AVG(final_score), 0),
        MAX(matches.ended_at)
    INTO
        v_total_matches,
        v_wins,
        v_total_score,
        v_best_score,
        v_avg_score,
        v_last_played
    FROM match_players
    JOIN matches ON match_players.match_id = matches.id
    WHERE match_players.player_id = p_player_id
      AND matches.status = 'completed';

    -- Calculate rank badge
    v_rank_badge := calculate_rank_badge(v_total_score);

    -- Update player profile
    UPDATE players
    SET
        total_matches = v_total_matches,
        wins = v_wins,
        total_score = v_total_score,
        best_score = v_best_score,
        avg_score = v_avg_score,
        rank_badge = v_rank_badge,
        last_played_at = v_last_played,
        updated_at = NOW()
    WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Insert Match History Function
-- =======================
-- Inserts a match into player's history (keeps last 10)
CREATE OR REPLACE FUNCTION insert_player_match_history(
    p_player_id UUID,
    p_match_id UUID,
    p_username VARCHAR(50),
    p_placement INTEGER,
    p_score INTEGER,
    p_total_players INTEGER,
    p_played_at TIMESTAMP
) RETURNS void AS $$
BEGIN
    -- Insert match record
    INSERT INTO player_match_history (
        player_id,
        match_id,
        username,
        placement,
        score,
        total_players,
        played_at
    ) VALUES (
        p_player_id,
        p_match_id,
        p_username,
        p_placement,
        p_score,
        p_total_players,
        p_played_at
    ) ON CONFLICT (player_id, match_id) DO NOTHING;

    -- Keep only last 10 matches per player
    DELETE FROM player_match_history
    WHERE id IN (
        SELECT id
        FROM player_match_history
        WHERE player_id = p_player_id
        ORDER BY played_at DESC
        OFFSET 10
    );
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 6. Generate Profile Token
-- =======================
-- Generates a secure random token for anonymous profile persistence
CREATE OR REPLACE FUNCTION generate_profile_token() RETURNS VARCHAR(64) AS $$
BEGIN
    -- Generate 32 random bytes, encode as hex (64 chars)
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 7. Create Player with Profile
-- =======================
-- Creates a new player with profile token
CREATE OR REPLACE FUNCTION create_player_with_profile(p_username VARCHAR(50)) RETURNS TABLE(
    player_id UUID,
    player_username VARCHAR(50),
    profile_token VARCHAR(64)
) AS $$
DECLARE
    v_player_id UUID;
    v_profile_token VARCHAR(64);
BEGIN
    -- Generate token
    v_profile_token := generate_profile_token();

    -- Insert player
    INSERT INTO players (username, profile_token)
    VALUES (p_username, v_profile_token)
    RETURNING id INTO v_player_id;

    -- Return player info
    RETURN QUERY SELECT v_player_id, p_username, v_profile_token;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 8. Migration Complete
-- =======================
-- Add comment to track migration
COMMENT ON TABLE player_match_history IS 'Stores last 10 matches per player for match history display';
COMMENT ON COLUMN players.profile_token IS 'Anonymous session token stored in localStorage for profile persistence';
COMMENT ON COLUMN players.rank_badge IS 'Player rank: Intern, Junior Engineer, Mid-Level Engineer, Senior Engineer, Staff Engineer';
