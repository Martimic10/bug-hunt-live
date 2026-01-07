-- Migration: Add Game Preferences to Players
-- Purpose: Store user's preferred language and difficulty settings
-- Date: 2026-01-07

-- =======================
-- 1. Add Preference Columns
-- =======================
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'javascript';
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_difficulty VARCHAR(20) DEFAULT 'medium';

-- Create index for preference lookups
CREATE INDEX IF NOT EXISTS idx_players_preferences ON players(preferred_language, preferred_difficulty);

-- =======================
-- 2. Update Player Preferences Function
-- =======================
CREATE OR REPLACE FUNCTION update_player_preferences(
    p_player_id UUID,
    p_language VARCHAR(20),
    p_difficulty VARCHAR(20)
) RETURNS void AS $$
BEGIN
    UPDATE players
    SET
        preferred_language = p_language,
        preferred_difficulty = p_difficulty,
        updated_at = NOW()
    WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 3. Get Player Preferences Function
-- =======================
CREATE OR REPLACE FUNCTION get_player_preferences(p_player_id UUID)
RETURNS TABLE(
    preferred_language VARCHAR(20),
    preferred_difficulty VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(players.preferred_language, 'javascript'::VARCHAR(20)),
        COALESCE(players.preferred_difficulty, 'medium'::VARCHAR(20))
    FROM players
    WHERE players.id = p_player_id;

    -- If player doesn't exist, return defaults
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'javascript'::VARCHAR(20), 'medium'::VARCHAR(20);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Comments
-- =======================
COMMENT ON COLUMN players.preferred_language IS 'User''s preferred programming language (javascript, python, etc.)';
COMMENT ON COLUMN players.preferred_difficulty IS 'User''s preferred difficulty level (easy, medium, hard)';
