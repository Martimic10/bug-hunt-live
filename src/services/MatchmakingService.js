const { v4: uuidv4 } = require('uuid');
const botService = require('./BotService');

class MatchmakingService {
  constructor() {
    this.waitingPlayers = []; // Queue of players waiting for match
    this.activeGames = new Map(); // matchId -> GameState
    this.queueTimers = new Map(); // socketId -> timeout ID for bot spawning
    this.io = null; // Will be set by server
  }

  // Set Socket.io instance (called by server during initialization)
  setIo(io) {
    this.io = io;
  }

  // Add player to matchmaking queue
  // playerId is the database UUID for the player profile
  addToQueue(socket, username, playerId = null) {
    const player = {
      id: playerId || uuidv4(), // Use database playerId if provided
      socketId: socket.id,
      username,
      joinedAt: Date.now()
    };

    this.waitingPlayers.push(player);
    console.log(`[Queue] ${username} joined (${this.waitingPlayers.length} waiting)`);

    // Start timer to spawn bots if not enough players join within 12 seconds
    this.startBotSpawnTimer(socket.id);

    return {
      player,
      position: this.waitingPlayers.length
    };
  }

  // Start timer to spawn bots for a waiting player
  startBotSpawnTimer(socketId) {
    // Clear existing timer if any
    this.clearBotSpawnTimer(socketId);

    // After 12 seconds, if still in queue and not enough players, fill with bots
    const timerId = setTimeout(() => {
      const player = this.waitingPlayers.find(p => p.socketId === socketId);
      if (player && this.waitingPlayers.length < 2) {
        console.log(`[Queue] Timeout reached for ${player.username}, creating match with bots`);
        const match = this.createMatchWithBots(socketId);

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

    const index = this.waitingPlayers.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
      const player = this.waitingPlayers.splice(index, 1)[0];
      console.log(`[Queue] ${player.username} left queue`);
      return player;
    }
    return null;
  }

  // Check if enough players to start a match
  canStartMatch() {
    return this.waitingPlayers.length >= 2;
  }

  // Create a new match from waiting players
  createMatch(minPlayers = 2, maxPlayers = 4) {
    if (!this.canStartMatch()) {
      return null;
    }

    // Take up to maxPlayers from queue
    const playersCount = Math.min(this.waitingPlayers.length, maxPlayers);
    const players = this.waitingPlayers.splice(0, playersCount);

    // Clear timers for players who are now in a match
    players.forEach(p => this.clearBotSpawnTimer(p.socketId));

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
      currentQuestionIndex: 0,
      status: 'waiting', // waiting -> in_progress -> completed
      createdAt: Date.now(),
      startedAt: null,
      questions: [], // Will be populated by QuestionService
      questionStartTime: null
    };

    this.activeGames.set(matchId, gameState);
    console.log(`[Match] Created match ${matchId} with ${players.length} players`);

    return {
      matchId,
      players: Array.from(gameState.players.values())
    };
  }

  // Create a match with bots to fill remaining slots
  createMatchWithBots(humanSocketId) {
    // Find the human player
    const humanPlayerIndex = this.waitingPlayers.findIndex(p => p.socketId === humanSocketId);
    if (humanPlayerIndex === -1) {
      console.log('[Queue] Player no longer in queue, skipping bot match creation');
      return null;
    }

    // Remove human player from queue
    const humanPlayer = this.waitingPlayers.splice(humanPlayerIndex, 1)[0];
    this.clearBotSpawnTimer(humanPlayer.socketId);

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
      currentQuestionIndex: 0,
      status: 'waiting',
      createdAt: Date.now(),
      startedAt: null,
      questions: [],
      questionStartTime: null,
      bots: bots // Store bot references for answer simulation
    };

    this.activeGames.set(matchId, gameState);
    console.log(`[Match] Created match ${matchId} with 1 human player and ${numBots} bots`);

    return {
      matchId,
      players: Array.from(gameState.players.values()),
      hasHumanPlayer: humanPlayer.socketId
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

  // Get stats
  getStats() {
    return {
      queueSize: this.waitingPlayers.length,
      activeGames: this.activeGames.size,
      waitingPlayers: this.waitingPlayers.map(p => ({
        username: p.username,
        waitTime: Date.now() - p.joinedAt
      }))
    };
  }
}

// Singleton instance
module.exports = new MatchmakingService();
