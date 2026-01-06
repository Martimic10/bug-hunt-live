-- Migration: Add Payment Gating for Multiplayer Profiles
-- Purpose: Only paid users get server-side profiles
-- Date: 2026-01-05

-- =======================
-- 1. Add Payment Status to Players
-- =======================
ALTER TABLE players ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stripe_payment_id VARCHAR(255);

-- Create index for payment lookups
CREATE INDEX IF NOT EXISTS idx_players_has_paid ON players(has_paid);
CREATE INDEX IF NOT EXISTS idx_players_stripe_payment ON players(stripe_payment_id);

-- =======================
-- 2. Modify Profile Token Generation
-- =======================
-- Profile tokens should only exist for paid users
-- Free users will have player_id in localStorage but no server profile

-- Update the create_player_with_profile function to require payment
CREATE OR REPLACE FUNCTION create_player_with_profile(
    p_username VARCHAR(50),
    p_player_id UUID DEFAULT NULL,
    p_stripe_payment_id VARCHAR(255) DEFAULT NULL
) RETURNS TABLE(
    player_id UUID,
    player_username VARCHAR(50),
    profile_token VARCHAR(64),
    has_paid BOOLEAN
) AS $$
DECLARE
    v_player_id UUID;
    v_profile_token VARCHAR(64);
BEGIN
    -- Use provided player_id or generate new one
    v_player_id := COALESCE(p_player_id, gen_random_uuid());

    -- Generate profile token only for paid users
    IF p_stripe_payment_id IS NOT NULL THEN
        v_profile_token := encode(gen_random_bytes(32), 'hex');
    END IF;

    -- Insert or update player
    INSERT INTO players (
        id,
        username,
        profile_token,
        has_paid,
        payment_date,
        stripe_payment_id,
        created_at
    ) VALUES (
        v_player_id,
        p_username,
        v_profile_token,
        (p_stripe_payment_id IS NOT NULL),
        CASE WHEN p_stripe_payment_id IS NOT NULL THEN NOW() ELSE NULL END,
        p_stripe_payment_id,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        profile_token = COALESCE(players.profile_token, EXCLUDED.profile_token),
        has_paid = CASE WHEN EXCLUDED.has_paid THEN TRUE ELSE players.has_paid END,
        payment_date = COALESCE(players.payment_date, EXCLUDED.payment_date),
        stripe_payment_id = COALESCE(players.stripe_payment_id, EXCLUDED.stripe_payment_id),
        updated_at = NOW();

    -- Return player info
    RETURN QUERY SELECT
        v_player_id,
        p_username,
        v_profile_token,
        (p_stripe_payment_id IS NOT NULL)::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 3. Check Payment Status Function
-- =======================
CREATE OR REPLACE FUNCTION check_player_payment_status(p_player_id UUID)
RETURNS TABLE(
    has_paid BOOLEAN,
    payment_date TIMESTAMP,
    profile_exists BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(players.has_paid, FALSE),
        players.payment_date,
        (players.profile_token IS NOT NULL)
    FROM players
    WHERE players.id = p_player_id;

    -- If player doesn't exist, return false for all
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Upgrade Free User to Paid
-- =======================
CREATE OR REPLACE FUNCTION upgrade_player_to_paid(
    p_player_id UUID,
    p_stripe_payment_id VARCHAR(255)
) RETURNS TABLE(
    success BOOLEAN,
    profile_token VARCHAR(64)
) AS $$
DECLARE
    v_profile_token VARCHAR(64);
BEGIN
    -- Generate profile token
    v_profile_token := encode(gen_random_bytes(32), 'hex');

    -- Update player to paid status
    UPDATE players
    SET
        has_paid = TRUE,
        payment_date = NOW(),
        stripe_payment_id = p_stripe_payment_id,
        profile_token = v_profile_token,
        updated_at = NOW()
    WHERE id = p_player_id;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_profile_token;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::VARCHAR(64);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Stats Update - Only for Paid Users
-- =======================
-- Modify update_player_profile_stats to only update paid users
CREATE OR REPLACE FUNCTION update_player_profile_stats(p_player_id UUID) RETURNS void AS $$
DECLARE
    v_total_matches INTEGER;
    v_wins INTEGER;
    v_total_score INTEGER;
    v_best_score INTEGER;
    v_avg_score DECIMAL(10,2);
    v_rank_badge VARCHAR(20);
    v_last_played TIMESTAMP;
    v_has_paid BOOLEAN;
BEGIN
    -- Check if user has paid
    SELECT has_paid INTO v_has_paid
    FROM players
    WHERE id = p_player_id;

    -- Only update stats for paid users
    IF v_has_paid IS NULL OR v_has_paid = FALSE THEN
        RETURN;
    END IF;

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
-- 6. Match History - Only for Paid Users
-- =======================
CREATE OR REPLACE FUNCTION insert_player_match_history(
    p_player_id UUID,
    p_match_id UUID,
    p_username VARCHAR(50),
    p_placement INTEGER,
    p_score INTEGER,
    p_total_players INTEGER,
    p_played_at TIMESTAMP
) RETURNS void AS $$
DECLARE
    v_has_paid BOOLEAN;
BEGIN
    -- Check if user has paid
    SELECT has_paid INTO v_has_paid
    FROM players
    WHERE id = p_player_id;

    -- Only store match history for paid users
    IF v_has_paid IS NULL OR v_has_paid = FALSE THEN
        RETURN;
    END IF;

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
-- 7. Comments
-- =======================
COMMENT ON COLUMN players.has_paid IS 'TRUE if user has paid for multiplayer access';
COMMENT ON COLUMN players.payment_date IS 'Date when user made payment';
COMMENT ON COLUMN players.stripe_payment_id IS 'Stripe payment intent ID for verification';
