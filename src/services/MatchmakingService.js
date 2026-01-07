const { v4: uuidv4 } = require('uuid');
const botService = require('./BotService');

class MatchmakingService {
  constructor() {
    // Change from array to Map grouped by preferences
    this.waitingPlayersByPreference = new Map(); // key: "lang:difficulty" -> array of players
    this.activeGames = new Map(); // matchId -> GameState
    this.queueTimers = new Map(); // socketId -> timeout ID for bot spawning
    this.io = null; // Will be set by server
  }

  // Set Socket.io instance (called by server during initialization)
  setIo(io) {
    this.io = io;
  }

  // Generate preference key for matchmaking
  getPreferenceKey(language, difficulty) {
    return `${language}:${difficulty}`;
  }

  // Add player to preference-based queue
  // playerId is the database UUID for the player profile
  addToQueue(socket, username, playerId = null, preferences = {}) {
    const { language = 'javascript', difficulty = 'medium' } = preferences;
    const prefKey = this.getPreferenceKey(language, difficulty);

    const player = {
      id: playerId || uuidv4(), // Use database playerId if provided
      socketId: socket.id,
      username,
      joinedAt: Date.now(),
      preferences: { language, difficulty }
    };

    // Get or create queue for this preference
    if (!this.waitingPlayersByPreference.has(prefKey)) {
      this.waitingPlayersByPreference.set(prefKey, []);
    }

    const queue = this.waitingPlayersByPreference.get(prefKey);
    queue.push(player);

    console.log(`[Queue] ${username} joined ${language}/${difficulty} queue (${queue.length} waiting)`);

    // Start timer to spawn bots if not enough players join within 12 seconds
    this.startBotSpawnTimer(socket.id, prefKey);

    return {
      player,
      position: queue.length,
      queueSize: queue.length,
      preferences
    };
  }

  // Start timer to spawn bots for a waiting player
  startBotSpawnTimer(socketId, prefKey) {
    // Clear existing timer if any
    this.clearBotSpawnTimer(socketId);

    // After 12 seconds, if still in queue and not enough players, fill with bots
    const timerId = setTimeout(() => {
      const queue = this.waitingPlayersByPreference.get(prefKey) || [];
      const player = queue.find(p => p.socketId === socketId);

      if (player && queue.length < 2) {
        console.log(`[Queue] Timeout reached for ${player.username}, creating match with bots`);
        const match = this.createMatchWithBots(socketId, prefKey);

        if (match && this.io) {
          // Dynamically require to avoid circular dependency
          const gameHandlers = require('../handlers/gameHandlers');
          gameHandlers.startBotMatch(this.io, match.matchId);
        }
      }
    }, 12000); // 12 seconds

    this.queueTimers.set(socketId, timerId);
  }

  // Clear bot spawn timer
  clearBotSpawnTimer(socketId) {
    const timerId = this.queueTimers.get(socketId);
    if (timerId) {
      clearTimeout(timerId);
      this.queueTimers.delete(socketId);
    }
  }

  // Remove player from queue
  removeFromQueue(socketId) {
    // Clear bot spawn timer
    this.clearBotSpawnTimer(socketId);

    // Search through all preference queues
    for (const [prefKey, queue] of this.waitingPlayersByPreference.entries()) {
      const index = queue.findIndex(p => p.socketId === socketId);
      if (index !== -1) {
        const player = queue.splice(index, 1)[0];
        console.log(`[Queue] ${player.username} left ${prefKey} queue`);

        // Clean up empty queues
        if (queue.length === 0) {
          this.waitingPlayersByPreference.delete(prefKey);
        }

        return player;
      }
    }
    return null;
  }

  // Check if enough players to start a match for specific preferences
  canStartMatch(prefKey) {
    const queue = this.waitingPlayersByPreference.get(prefKey) || [];
    return queue.length >= 2;
  }

  // Create a new match from waiting players with same preferences
  createMatch(prefKey, minPlayers = 2, maxPlayers = 4) {
    const queue = this.waitingPlayersByPreference.get(prefKey) || [];

    if (queue.length < minPlayers) {
      return null;
    }

    // Take up to maxPlayers from queue
    const playersCount = Math.min(queue.length, maxPlayers);
    const players = queue.splice(0, playersCount);

    // Clean up empty queue
    if (queue.length === 0) {
      this.waitingPlayersByPreference.delete(prefKey);
    }

    // Clear timers for players who are now in a match
    players.forEach(p => this.clearBotSpawnTimer(p.socketId));

    // Extract preferences from first player (all same in this queue)
    const { language, difficulty } = players[0].preferences;

    const matchId = uuidv4();
    const gameState = {
      matchId,
      players: new Map(players.map(p => [p.socketId, {
        id: p.id,
        socketId: p.socketId,
        username: p.username,
        score: 0,
        answers: [], // Track all answers for this player
        isActive: true
      }])),
      preferences: { language, difficulty }, // Store match preferences
      currentQuestionIndex: 0,
      status: 'waiting', // waiting -> in_progress -> completed
      createdAt: Date.now(),
      startedAt: null,
      questions: [], // Will be populated by QuestionService
      questionStartTime: null
    };

    this.activeGames.set(matchId, gameState);
    console.log(`[Match] Created match ${matchId} with ${players.length} players (${language}/${difficulty})`);

    return {
      matchId,
      players: Array.from(gameState.players.values()),
      preferences: { language, difficulty }
    };
  }

  // Create a match with bots to fill remaining slots
  createMatchWithBots(humanSocketId, prefKey) {
    const queue = this.waitingPlayersByPreference.get(prefKey) || [];

    // Find the human player
    const humanPlayerIndex = queue.findIndex(p => p.socketId === humanSocketId);
    if (humanPlayerIndex === -1) {
      console.log('[Queue] Player no longer in queue, skipping bot match creation');
      return null;
    }

    // Remove human player from queue
    const humanPlayer = queue.splice(humanPlayerIndex, 1)[0];
    this.clearBotSpawnTimer(humanPlayer.socketId);

    // Clean up empty queue
    if (queue.length === 0) {
      this.waitingPlayersByPreference.delete(prefKey);
    }

    const { language, difficulty } = humanPlayer.preferences;
    const matchId = uuidv4();

    // Create 2-3 bot players to fill the match (total 3-4 players)
    const numBots = 2 + Math.floor(Math.random() * 2); // 2 or 3 bots
    const bots = botService.createBots(matchId, numBots);

    // Combine human and bot players
    const allPlayers = [humanPlayer, ...bots];

    const gameState = {
      matchId,
      players: new Map(allPlayers.map(p => [p.socketId, {
        id: p.id,
        socketId: p.socketId,
        username: p.username,
        score: 0,
        answers: [],
        isActive: true,
        isBot: p.isBot || false
      }])),
      preferences: { language, difficulty }, // Store match preferences
      currentQuestionIndex: 0,
      status: 'waiting',
      createdAt: Date.now(),
      startedAt: null,
      questions: [],
      questionStartTime: null,
      bots: bots // Store bot references for answer simulation
    };

    this.activeGames.set(matchId, gameState);
    console.log(`[Match] Created match ${matchId} with 1 human player and ${numBots} bots (${language}/${difficulty})`);

    return {
      matchId,
      players: Array.from(gameState.players.values()),
      hasHumanPlayer: humanPlayer.socketId,
      preferences: { language, difficulty }
    };
  }

  // Get game state by match ID
  getGame(matchId) {
    return this.activeGames.get(matchId);
  }

  // Get game state by socket ID
  getGameBySocket(socketId) {
    for (const [matchId, game] of this.activeGames.entries()) {
      if (game.players.has(socketId)) {
        return { matchId, game };
      }
    }
    return null;
  }

  // Mark player as disconnected
  handlePlayerDisconnect(socketId) {
    // Remove from queue if waiting
    this.removeFromQueue(socketId);

    // Mark as inactive in active game
    const result = this.getGameBySocket(socketId);
    if (result) {
      const player = result.game.players.get(socketId);
      if (player) {
        player.isActive = false;
        console.log(`[Match] ${player.username} disconnected from match ${result.matchId}`);
      }
      return result;
    }
    return null;
  }

  // End game and cleanup
  endGame(matchId) {
    const game = this.activeGames.get(matchId);
    if (game) {
      game.status = 'completed';
      console.log(`[Match] Game ${matchId} ended`);

      // Cleanup bots
      botService.cleanupBots(matchId);

      // Keep in memory for 1 minute for final stats, then cleanup
      setTimeout(() => {
        this.activeGames.delete(matchId);
        console.log(`[Match] Cleaned up game ${matchId}`);
      }, 60000);

      return game;
    }
    return null;
  }

  // Get stats with preference breakdown
  getStats() {
    const stats = {
      totalWaiting: 0,
      queuesByPreference: []
    };

    this.waitingPlayersByPreference.forEach((queue, prefKey) => {
      const [language, difficulty] = prefKey.split(':');
      stats.totalWaiting += queue.length;
      stats.queuesByPreference.push({
        language,
        difficulty,
        count: queue.length,
        players: queue.map(p => ({
          username: p.username,
          waitTime: Date.now() - p.joinedAt
        }))
      });
    });

    return {
      queueSize: stats.totalWaiting,
      activeGames: this.activeGames.size,
      queueDetails: stats.queuesByPreference
    };
  }
}

// Singleton instance
module.exports = new MatchmakingService();
