require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const gameHandlers = require('./handlers/gameHandlers');
const matchmakingService = require('./services/MatchmakingService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS for browser clients
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow any localhost port in development
      if (!origin || origin.match(/^http:\/\/localhost:\d+$/)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set Socket.io instance on matchmaking service for bot match creation
matchmakingService.setIo(io);

// Middleware
app.use(express.json());

// CORS middleware for HTTP endpoints (practice mode API)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow localhost on any port for development
  if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic stats endpoint
app.get('/api/stats', (req, res) => {
  const stats = {
    activeGames: gameHandlers.getActiveGamesCount(),
    playersInQueue: gameHandlers.getQueueSize(),
    connectedPlayers: io.engine.clientsCount
  };
  res.json(stats);
});

// Leaderboard endpoints
const db = require('./config/database');
const questionService = require('./services/QuestionService');

// Get global leaderboard (top 50 by total score)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await db.getLeaderboard(Math.min(limit, 50));

    res.json({
      success: true,
      leaderboard: leaderboard.map((player, index) => ({
        rank: index + 1,
        username: player.username,
        totalScore: parseInt(player.total_score),
        totalMatches: parseInt(player.total_matches),
        avgScore: parseFloat(player.avg_score),
        bestScore: parseInt(player.best_score),
        wins: parseInt(player.wins),
        lastPlayed: player.last_played
      }))
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// Get top scores (single game leaderboard)
app.get('/api/leaderboard/top-scores', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topScores = await db.getTopScores(Math.min(limit, 50));

    res.json({
      success: true,
      topScores: topScores.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        score: parseInt(entry.score),
        playedAt: entry.played_at,
        matchId: entry.match_id
      }))
    });
  } catch (error) {
    console.error('Error fetching top scores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top scores'
    });
  }
});

// Get player stats by username
app.get('/api/player/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const stats = await db.getPlayerStats(username);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }

    res.json({
      success: true,
      player: {
        username,
        totalMatches: parseInt(stats.total_matches),
        totalScore: parseInt(stats.total_score),
        avgScore: parseFloat(stats.avg_score),
        bestScore: parseInt(stats.best_score),
        wins: parseInt(stats.wins),
        lastPlayed: stats.last_played
      }
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player stats'
    });
  }
});

// Practice Mode API endpoints (no Socket.io, single player)

// Get random questions for practice mode
app.get('/api/practice/questions', (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    const questions = questionService.getQuestionsForMatch(Math.min(count, 10));

    // Return questions without correct answers
    const questionsForClient = questions.map(q => ({
      id: q.id,
      code: q.code,
      question: q.question,
      choices: q.choices
    }));

    res.json({
      success: true,
      questions: questionsForClient,
      timeLimit: 30 // seconds per question
    });
  } catch (error) {
    console.error('Error fetching practice questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions'
    });
  }
});

// Check answer for practice mode (client-side scoring)
app.post('/api/practice/check-answer', (req, res) => {
  try {
    const { questionId, answerId } = req.body;

    if (!questionId || !answerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing questionId or answerId'
      });
    }

    const result = questionService.checkAnswer(questionId, answerId);

    if (!result.isValid) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      correct: result.isCorrect,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      points: result.points
    });
  } catch (error) {
    console.error('Error checking answer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check answer'
    });
  }
});

// ========================================
// PLAYER PROFILE API (Anonymous Profiles)
// ========================================

// Get player profile by ID with match history
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID format'
      });
    }

    // Fetch complete player profile with match history
    const data = await db.getCompletePlayerProfile(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Player profile not found'
      });
    }

    // Format response
    res.json({
      success: true,
      profile: {
        id: data.profile.id,
        username: data.profile.username,
        totalMatches: data.profile.total_matches || 0,
        wins: data.profile.wins || 0,
        totalScore: data.profile.total_score || 0,
        bestScore: data.profile.best_score || 0,
        avgScore: parseFloat(data.profile.avg_score) || 0,
        rankBadge: data.profile.rank_badge || 'Intern',
        lastPlayedAt: data.profile.last_played_at,
        createdAt: data.profile.created_at
      },
      matchHistory: data.matchHistory.map(match => ({
        matchId: match.match_id,
        placement: match.placement,
        score: match.score,
        totalPlayers: match.total_players,
        playedAt: match.played_at
      }))
    });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player profile'
    });
  }
});

// Update player username
app.put('/api/profile/:id/username', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID format'
      });
    }

    // Validate username
    if (!username || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Username cannot be empty'
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters'
      });
    }

    if (username.trim().length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 20 characters or less'
      });
    }

    // Update username in database
    const result = await db.updatePlayerUsername(id, username.trim());

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Player not found'
      });
    }

    res.json({
      success: true,
      username: username.trim()
    });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update username'
    });
  }
});

// Get or create player by profile token (for session restoration)
app.post('/api/profile/restore', async (req, res) => {
  try {
    const { profileToken } = req.body;

    if (!profileToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing profileToken'
      });
    }

    // Try to find player by token
    const player = await db.getPlayerByToken(profileToken);

    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      player: {
        id: player.id,
        username: player.username,
        profileToken: player.profile_token,
        totalMatches: player.total_matches || 0,
        wins: player.wins || 0,
        totalScore: player.total_score || 0,
        bestScore: player.best_score || 0,
        avgScore: parseFloat(player.avg_score) || 0,
        rankBadge: player.rank_badge || 'Intern',
        lastPlayedAt: player.last_played_at
      }
    });
  } catch (error) {
    console.error('Error restoring profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore profile'
    });
  }
});

// Check payment status for a player
app.get('/api/payment/status/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const status = await db.checkPlayerPaymentStatus(playerId);

    res.json({
      success: true,
      hasPaid: status.hasPaid,
      paymentDate: status.paymentDate,
      profileExists: status.profileExists
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
});

// Create Stripe Payment Intent
app.post('/api/payment/create-intent', async (req, res) => {
  try {
    const { playerId, amount } = req.body;

    if (!playerId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId or amount'
      });
    }

    // Create a Payment Intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents (e.g., 1900 = $19.00)
      currency: 'usd',
      metadata: {
        playerId: playerId
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
});

// Upgrade player to paid status after Stripe payment
app.post('/api/payment/upgrade', async (req, res) => {
  try {
    const { playerId, stripePaymentId } = req.body;

    if (!playerId || !stripePaymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing playerId or stripePaymentId'
      });
    }

    // Check if this is a mock payment (for testing)
    const isMockPayment = stripePaymentId.startsWith('mock_payment_');

    if (!isMockPayment) {
      // Verify real payment with Stripe API before upgrading
      const stripePayment = await stripe.paymentIntents.retrieve(stripePaymentId);

      if (stripePayment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          error: 'Payment not completed. Status: ' + stripePayment.status
        });
      }

      // Verify the payment matches this player
      if (stripePayment.metadata.playerId !== playerId) {
        return res.status(400).json({
          success: false,
          error: 'Payment does not match player ID'
        });
      }
    } else {
      console.log('⚠️ Mock payment detected:', stripePaymentId, '- Skipping Stripe verification');
    }

    const result = await db.upgradePlayerToPaid(playerId, stripePaymentId);

    if (result.success) {
      res.json({
        success: true,
        profileToken: result.profileToken,
        message: 'Player upgraded to paid status'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
  } catch (error) {
    console.error('Error upgrading player:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade player'
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Connection] Player connected: ${socket.id}`);

  // Register all game event handlers
  gameHandlers.registerHandlers(socket, io);

  socket.on('disconnect', () => {
    console.log(`[Disconnect] Player disconnected: ${socket.id}`);
    gameHandlers.handleDisconnect(socket, io);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 BugHunt Live Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Stats:  http://localhost:${PORT}/api/stats\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
