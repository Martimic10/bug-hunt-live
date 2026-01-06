const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Database helper functions
const db = {
  query: (text, params) => pool.query(text, params),

  // Save completed match to database
  async saveMatch(matchData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert match record
      const matchResult = await client.query(
        `INSERT INTO matches (id, status, started_at, ended_at)
         VALUES ($1, 'completed', $2, $3)
         RETURNING id`,
        [matchData.matchId, matchData.startedAt, new Date()]
      );

      // Insert player results
      for (const player of matchData.players) {
        await client.query(
          `INSERT INTO match_players (match_id, player_id, username, final_score, rank)
           VALUES ($1, $2, $3, $4, $5)`,
          [matchResult.rows[0].id, player.id, player.username, player.score, player.rank]
        );
      }

      await client.query('COMMIT');
      return matchResult.rows[0].id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get global leaderboard by total score (top 50)
  async getLeaderboard(limit = 50) {
    try {
      const result = await pool.query(
        `SELECT
           username,
           total_matches,
           total_score,
           ROUND(avg_score::numeric, 2) as avg_score,
           best_score,
           wins,
           last_played
         FROM leaderboard_stats
         ORDER BY total_score DESC, wins DESC, best_score DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      // Fallback if materialized view doesn't exist yet
      console.warn('Leaderboard view not found, using fallback query');
      const result = await pool.query(
        `SELECT
           username,
           COUNT(DISTINCT mp.match_id) as total_matches,
           SUM(mp.final_score) as total_score,
           ROUND(AVG(mp.final_score)::numeric, 2) as avg_score,
           MAX(mp.final_score) as best_score,
           COUNT(CASE WHEN mp.rank = 1 THEN 1 END) as wins,
           MAX(m.ended_at) as last_played
         FROM match_players mp
         JOIN matches m ON mp.match_id = m.id
         WHERE m.status = 'completed'
         GROUP BY username
         ORDER BY total_score DESC, wins DESC, best_score DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    }
  },

  // Get top scores (single game performance)
  async getTopScores(limit = 50) {
    const result = await pool.query(
      `SELECT
         mp.username,
         mp.final_score as score,
         m.ended_at as played_at,
         m.id as match_id
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE m.status = 'completed'
       ORDER BY mp.final_score DESC, m.ended_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  // Get player stats by username
  async getPlayerStats(username) {
    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT mp.match_id) as total_matches,
         SUM(mp.final_score) as total_score,
         ROUND(AVG(mp.final_score)::numeric, 2) as avg_score,
         MAX(mp.final_score) as best_score,
         COUNT(CASE WHEN mp.rank = 1 THEN 1 END) as wins,
         MAX(m.ended_at) as last_played
       FROM match_players mp
       JOIN matches m ON mp.match_id = m.id
       WHERE mp.username = $1 AND m.status = 'completed'
       GROUP BY mp.username`,
      [username]
    );
    return result.rows[0] || null;
  },

  // Refresh leaderboard materialized view
  async refreshLeaderboard() {
    try {
      await pool.query('SELECT refresh_leaderboard()');
      console.log('✅ Leaderboard refreshed');
    } catch (error) {
      console.warn('Could not refresh leaderboard view:', error.message);
    }
  },

  // ========================================
  // PLAYER PROFILE FUNCTIONS (Anonymous)
  // ========================================

  /**
   * Create a new player with profile token
   * For paid users: creates profile with token
   * For free users: creates minimal record without profile
   * Returns: { playerId, username, profileToken, hasPaid }
   */
  async createPlayerWithProfile(username, playerId = null, stripePaymentId = null) {
    const result = await pool.query(
      `SELECT * FROM create_player_with_profile($1, $2, $3)`,
      [username, playerId, stripePaymentId]
    );
    return {
      playerId: result.rows[0].player_id,
      username: result.rows[0].player_username,
      profileToken: result.rows[0].profile_token,
      hasPaid: result.rows[0].has_paid
    };
  },

  /**
   * Check if a player has paid for multiplayer access
   * Returns: { hasPaid, paymentDate, profileExists }
   */
  async checkPlayerPaymentStatus(playerId) {
    const result = await pool.query(
      `SELECT * FROM check_player_payment_status($1)`,
      [playerId]
    );
    if (result.rows.length === 0) {
      return { hasPaid: false, paymentDate: null, profileExists: false };
    }
    return {
      hasPaid: result.rows[0].has_paid,
      paymentDate: result.rows[0].payment_date,
      profileExists: result.rows[0].profile_exists
    };
  },

  /**
   * Upgrade a free user to paid status after successful payment
   * Returns: { success, profileToken }
   */
  async upgradePlayerToPaid(playerId, stripePaymentId) {
    try {
      // Generate profile token
      const crypto = require('crypto');
      const profileToken = crypto.randomBytes(32).toString('hex');

      // Create temporary username
      const tempUsername = `Player_${playerId.substring(0, 8)}`;

      // Insert or update player
      const result = await pool.query(
        `INSERT INTO players (
          id, username, has_paid, payment_date, stripe_payment_id, profile_token
        ) VALUES ($1, $2, TRUE, NOW(), $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          has_paid = TRUE,
          payment_date = NOW(),
          stripe_payment_id = $3,
          profile_token = $4,
          updated_at = NOW()
        RETURNING id, profile_token`,
        [playerId, tempUsername, stripePaymentId, profileToken]
      );

      return {
        success: true,
        profileToken: result.rows[0].profile_token
      };
    } catch (error) {
      console.error('Error in upgradePlayerToPaid:', error);
      return {
        success: false,
        profileToken: null
      };
    }
  },

  /**
   * Get player by profile token (for anonymous session restoration)
   * Returns: player object or null
   */
  async getPlayerByToken(profileToken) {
    const result = await pool.query(
      `SELECT id, username, profile_token, total_matches, wins, total_score,
              best_score, avg_score, rank_badge, last_played_at, created_at
       FROM players
       WHERE profile_token = $1`,
      [profileToken]
    );
    return result.rows[0] || null;
  },

  /**
   * Get player profile by ID
   * Returns: complete profile with stats
   */
  async getPlayerProfile(playerId) {
    const result = await pool.query(
      `SELECT id, username, profile_token, total_matches, wins, total_score,
              best_score, avg_score, rank_badge, last_played_at, created_at
       FROM players
       WHERE id = $1`,
      [playerId]
    );
    return result.rows[0] || null;
  },

  /**
   * Update player profile stats after match
   * This should be called after saveMatch()
   */
  async updatePlayerProfileStats(playerId) {
    await pool.query(
      `SELECT update_player_profile_stats($1)`,
      [playerId]
    );
  },

  /**
   * Insert match into player's history (keeps last 10)
   */
  async insertPlayerMatchHistory(playerId, matchId, username, placement, score, totalPlayers, playedAt) {
    await pool.query(
      `SELECT insert_player_match_history($1, $2, $3, $4, $5, $6, $7)`,
      [playerId, matchId, username, placement, score, totalPlayers, playedAt]
    );
  },

  /**
   * Get player's match history (last 10 matches)
   * Returns: array of match records
   */
  async getPlayerMatchHistory(playerId) {
    const result = await pool.query(
      `SELECT match_id, username, placement, score, total_players, played_at
       FROM player_match_history
       WHERE player_id = $1
       ORDER BY played_at DESC
       LIMIT 10`,
      [playerId]
    );
    return result.rows;
  },

  /**
   * Get complete player profile with match history
   * Returns: { profile, matchHistory }
   */
  async getCompletePlayerProfile(playerId) {
    const profile = await this.getPlayerProfile(playerId);
    if (!profile) {
      return null;
    }

    const matchHistory = await this.getPlayerMatchHistory(playerId);

    return {
      profile,
      matchHistory
    };
  },

  /**
   * Update player username
   * Returns: { success, username, error }
   */
  async updatePlayerUsername(playerId, username) {
    try {
      const result = await pool.query(
        `UPDATE players
         SET username = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, username`,
        [username, playerId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Player not found' };
      }

      return { success: true, username: result.rows[0].username };
    } catch (error) {
      console.error('Error updating username:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = db;
