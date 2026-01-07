const matchmakingService = require('../services/MatchmakingService');
const questionService = require('../services/QuestionService');
const db = require('../config/database');
const botService = require('../services/BotService');

// Constants
const QUESTIONS_PER_GAME = 5;
const QUESTION_TIME_LIMIT = 30000; // 30 seconds
const NEXT_QUESTION_DELAY = 3000; // 3 seconds between questions
const GAME_START_COUNTDOWN = 3000; // 3 seconds before game starts

// Register all socket event handlers
function registerHandlers(socket, io) {
  // Player joins matchmaking queue
  socket.on('join_queue', async (data) => {
    const { username, profileToken, playerId: clientPlayerId, preferences } = data;

    if (!username || username.trim().length === 0) {
      socket.emit('error', { message: 'Username is required' });
      return;
    }

    // Default preferences if not provided
    const gamePreferences = {
      language: preferences?.language || 'javascript',
      difficulty: preferences?.difficulty || 'medium'
    };

    try {
      let playerId = clientPlayerId;
      let token = profileToken;
      let hasPaid = false;

      // If profileToken provided, verify it exists
      if (profileToken) {
        const existingPlayer = await db.getPlayerByToken(profileToken);
        if (existingPlayer) {
          playerId = existingPlayer.id;
          hasPaid = true; // Has profile token means they paid
        }
      } else if (playerId) {
        // Check if this player_id has paid
        const paymentStatus = await db.checkPlayerPaymentStatus(playerId);
        hasPaid = paymentStatus.hasPaid;

        if (hasPaid && paymentStatus.profileExists) {
          // Get their profile token
          const player = await db.getPlayerProfile(playerId);
          token = player?.profile_token;
        }
      }

      // If no player_id, generate one (but don't create paid profile yet)
      if (!playerId) {
        const { playerId: newId } = await db.createPlayerWithProfile(username.trim(), null, null);
        playerId = newId;
        hasPaid = false;
      }

      // Add to queue with player ID and preferences
      const { position, queueSize, preferences: confirmedPreferences } = matchmakingService.addToQueue(
        socket,
        username.trim(),
        playerId,
        gamePreferences
      );

      socket.emit('queue_joined', {
        position,
        playersWaiting: queueSize,
        playerId,
        profileToken: token,
        hasPaid,
        preferences: confirmedPreferences
      });

      // Try to create a match for this preference group
      const prefKey = matchmakingService.getPreferenceKey(
        gamePreferences.language,
        gamePreferences.difficulty
      );
      tryStartMatchForPreference(io, prefKey);
    } catch (error) {
      console.error('Error joining queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // Player leaves queue
  socket.on('leave_queue', () => {
    matchmakingService.removeFromQueue(socket.id);
    socket.emit('queue_left', {});
  });

  // Player submits answer
  socket.on('submit_answer', async (data) => {
    const { answerId, questionId } = data;

    // Find which game this player is in
    const result = matchmakingService.getGameBySocket(socket.id);
    if (!result) {
      socket.emit('error', { message: 'Not in an active game' });
      return;
    }

    const { matchId, game } = result;
    const player = game.players.get(socket.id);

    if (!player || !player.isActive) {
      return;
    }

    // Check if answer already submitted for this question
    if (player.answers.some(a => a.questionId === questionId)) {
      socket.emit('error', { message: 'Answer already submitted' });
      return;
    }

    // Validate answer with language context
    const language = game.preferences?.language || 'javascript';
    const result2 = questionService.checkAnswer(questionId, answerId, language);
    if (!result2.isValid) {
      socket.emit('error', { message: result2.error });
      return;
    }

    // Record answer
    const answerData = {
      questionId,
      answerId,
      isCorrect: result2.isCorrect,
      points: result2.points,
      timestamp: Date.now(),
      responseTime: Date.now() - game.questionStartTime
    };

    player.answers.push(answerData);
    player.score += result2.points;

    console.log(`[Game ${matchId}] ${player.username} answered ${result2.isCorrect ? 'correctly' : 'incorrectly'}`);

    // Send individual result
    socket.emit('answer_result', {
      correct: result2.isCorrect,
      correctAnswer: result2.correctAnswer,
      explanation: result2.explanation,
      pointsEarned: result2.points
    });

    // Check if all active players have answered
    const allAnswered = Array.from(game.players.values())
      .filter(p => p.isActive)
      .every(p => p.answers.some(a => a.questionId === questionId));

    if (allAnswered) {
      // Send round scores to all players
      sendRoundScores(io, matchId, game);

      // Move to next question after delay
      setTimeout(() => {
        nextQuestion(io, matchId, game);
      }, NEXT_QUESTION_DELAY);
    }
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    const result = matchmakingService.handlePlayerDisconnect(socket.id);
    if (result) {
      const { matchId, game } = result;
      const player = game.players.get(socket.id);

      // Notify other players
      io.to(`match-${matchId}`).emit('player_left', {
        playerId: player.id,
        username: player.username
      });

      // If all human players left, end the game
      const hasHumanPlayers = Array.from(game.players.values()).some(p => p.isActive && !p.isBot);
      if (!hasHumanPlayers && game.status === 'in_progress') {
        console.log(`[Game ${matchId}] All human players left, ending game`);
        endGame(io, matchId, game);
      }
    }
  });
}

// Handle bot submitting an answer
function handleBotAnswer(io, matchId, game, bot, questionId, answerId) {
  const botPlayer = game.players.get(bot.socketId);

  if (!botPlayer || !botPlayer.isActive) {
    return;
  }

  // Check if answer already submitted
  if (botPlayer.answers.some(a => a.questionId === questionId)) {
    return;
  }

  // Validate answer with language context
  const language = game.preferences?.language || 'javascript';
  const result = questionService.checkAnswer(questionId, answerId, language);
  if (!result.isValid) {
    return;
  }

  // Record answer
  const answerData = {
    questionId,
    answerId,
    isCorrect: result.isCorrect,
    points: result.points,
    timestamp: Date.now(),
    responseTime: Date.now() - game.questionStartTime
  };

  botPlayer.answers.push(answerData);
  botPlayer.score += result.points;

  console.log(`[Game ${matchId}] Bot ${botPlayer.username} answered ${result.isCorrect ? 'correctly' : 'incorrectly'}`);

  // Check if all active players have answered
  const allAnswered = Array.from(game.players.values())
    .filter(p => p.isActive)
    .every(p => p.answers.some(a => a.questionId === questionId));

  if (allAnswered) {
    // Send round scores to all players
    sendRoundScores(io, matchId, game);

    // Move to next question after delay
    setTimeout(() => {
      nextQuestion(io, matchId, game);
    }, NEXT_QUESTION_DELAY);
  }
}

// Try to start a match for specific preference group
function tryStartMatchForPreference(io, prefKey) {
  if (!matchmakingService.canStartMatch(prefKey)) {
    return;
  }

  const match = matchmakingService.createMatch(prefKey, 2, 4);
  if (!match) {
    return;
  }

  const { matchId, players, preferences } = match;
  const game = matchmakingService.getGame(matchId);

  // Get questions for this match's language
  game.questions = questionService.getQuestionsForMatch(QUESTIONS_PER_GAME, preferences.language);

  // Get time limit based on difficulty
  const timeLimit = questionService.getTimeLimit(preferences.difficulty);
  game.questionTimeLimit = timeLimit * 1000; // Convert to milliseconds

  // Create Socket.io room
  players.forEach(player => {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.join(`match-${matchId}`);
    }
  });

  // Notify all players match found
  io.to(`match-${matchId}`).emit('match_found', {
    matchId,
    players: players.map(p => ({
      id: p.id,
      username: p.username
    })),
    preferences
  });

  // Start game after countdown
  setTimeout(() => {
    startGame(io, matchId, game);
  }, GAME_START_COUNTDOWN);
}

// Legacy function - kept for backward compatibility
function tryStartMatch(io) {
  // Default to javascript:medium for backward compatibility
  tryStartMatchForPreference(io, 'javascript:medium');
}

// Start the game
function startGame(io, matchId, game) {
  game.status = 'in_progress';
  game.startedAt = Date.now();

  // Use game-specific time limit or default
  const timeLimit = game.questionTimeLimit || QUESTION_TIME_LIMIT;
  const language = game.preferences?.language || 'javascript';
  const difficulty = game.preferences?.difficulty || 'medium';

  console.log(`[Game ${matchId}] Starting game with ${game.players.size} players (${language}/${difficulty})`);

  // Notify players game is starting
  io.to(`match-${matchId}`).emit('game_start', {
    totalQuestions: game.questions.length,
    questionTimeLimit: timeLimit / 1000,
    preferences: game.preferences
  });

  // Send first question
  setTimeout(() => {
    sendQuestion(io, matchId, game);
  }, 1000);
}

// Send current question to all players
function sendQuestion(io, matchId, game) {
  if (game.currentQuestionIndex >= game.questions.length) {
    endGame(io, matchId, game);
    return;
  }

  const question = game.questions[game.currentQuestionIndex];
  game.questionStartTime = Date.now();

  const questionData = questionService.getQuestionForClient(question.id);

  io.to(`match-${matchId}`).emit('question', {
    ...questionData,
    questionNumber: game.currentQuestionIndex + 1,
    totalQuestions: game.questions.length
  });

  console.log(`[Game ${matchId}] Sent question ${game.currentQuestionIndex + 1}/${game.questions.length}`);

  // Simulate bot answers if there are bots in the game
  if (game.bots && game.bots.length > 0) {
    game.bots.forEach(bot => {
      const botPlayer = game.players.get(bot.socketId);
      if (botPlayer && botPlayer.isActive) {
        botService.simulateBotAnswer(bot, question, question.correctAnswer, (bot, questionId, answerId) => {
          // Simulate bot submitting answer
          handleBotAnswer(io, matchId, game, bot, questionId, answerId);
        });
      }
    });
  }

  // Auto-advance if time runs out
  setTimeout(() => {
    const currentQuestion = game.questions[game.currentQuestionIndex];

    // Check if we're still on the same question
    if (currentQuestion && currentQuestion.id === question.id) {
      console.log(`[Game ${matchId}] Question ${game.currentQuestionIndex + 1} timed out`);
      sendRoundScores(io, matchId, game);

      setTimeout(() => {
        nextQuestion(io, matchId, game);
      }, NEXT_QUESTION_DELAY);
    }
  }, QUESTION_TIME_LIMIT);
}

// Send round scores to all players
function sendRoundScores(io, matchId, game) {
  const currentQuestion = game.questions[game.currentQuestionIndex];

  const scores = Array.from(game.players.values())
    .filter(p => p.isActive)
    .map(p => {
      const answer = p.answers.find(a => a.questionId === currentQuestion.id);
      return {
        playerId: p.id,
        username: p.username,
        score: p.score,
        isCorrect: answer ? answer.isCorrect : false,
        responseTime: answer ? answer.responseTime : null
      };
    })
    .sort((a, b) => b.score - a.score); // Sort by score descending

  io.to(`match-${matchId}`).emit('round_scores', { scores });
}

// Move to next question
function nextQuestion(io, matchId, game) {
  game.currentQuestionIndex++;

  if (game.currentQuestionIndex >= game.questions.length) {
    endGame(io, matchId, game);
  } else {
    sendQuestion(io, matchId, game);
  }
}

// End the game
async function endGame(io, matchId, game) {
  game.status = 'completed';

  // Calculate final scores and rankings (include all players for display)
  const finalScores = Array.from(game.players.values())
    .filter(p => p.isActive)
    .map(p => ({
      id: p.id,
      username: p.username,
      score: p.score,
      correctAnswers: p.answers.filter(a => a.isCorrect).length,
      totalAnswers: p.answers.length,
      isBot: p.isBot || false
    }))
    .sort((a, b) => b.score - a.score);

  // Assign ranks
  finalScores.forEach((player, index) => {
    player.rank = index + 1;
  });

  const winner = finalScores[0];

  console.log(`[Game ${matchId}] Game ended. Winner: ${winner.username} (${winner.score} points)`);

  // Notify all players
  io.to(`match-${matchId}`).emit('game_end', {
    finalScores,
    winner
  });

  // Save to database (only human players)
  try {
    // Filter out bots for database storage
    const humanPlayers = finalScores.filter(p => !p.isBot);

    if (humanPlayers.length > 0) {
      const savedMatchId = await db.saveMatch({
        matchId,
        startedAt: new Date(game.startedAt),
        players: humanPlayers
      });
      console.log(`[Game ${matchId}] Saved to database with ${humanPlayers.length} human players`);

      // Update player profiles and match history (only for human players)
      const matchEndTime = new Date();
      for (const player of humanPlayers) {
        try {
          // Update player profile stats (total matches, wins, scores, rank badge)
          await db.updatePlayerProfileStats(player.id);

          // Insert into match history (keeps last 10)
          await db.insertPlayerMatchHistory(
            player.id,
            savedMatchId,
            player.username,
            player.rank, // placement (1st, 2nd, 3rd, 4th)
            player.score,
            finalScores.length, // total players in match (including bots for context)
            matchEndTime
          );
        } catch (profileError) {
          console.error(`[Game ${matchId}] Failed to update profile for ${player.username}:`, profileError.message);
        }
      }
    } else {
      console.log(`[Game ${matchId}] No human players to save (bot-only match)`);
    }

    // Refresh leaderboard after match completion
    await db.refreshLeaderboard();
  } catch (error) {
    console.error(`[Game ${matchId}] Failed to save to database:`, error);
  }

  // Cleanup
  matchmakingService.endGame(matchId);
}

// Handle player disconnect
function handleDisconnect(socket, io) {
  const result = matchmakingService.handlePlayerDisconnect(socket.id);

  if (result) {
    const { matchId, game } = result;
    const player = game.players.get(socket.id);

    // Notify other players
    io.to(`match-${matchId}`).emit('player_left', {
      playerId: player.id,
      username: player.username
    });

    // Check if all players disconnected
    const activePlayers = Array.from(game.players.values()).filter(p => p.isActive);
    if (activePlayers.length === 0) {
      console.log(`[Game ${matchId}] All players disconnected, ending game`);
      matchmakingService.endGame(matchId);
    }
  }
}

// Helper functions for server stats
function getActiveGamesCount() {
  return matchmakingService.getStats().activeGames;
}

function getQueueSize() {
  return matchmakingService.getStats().queueSize;
}

// Start a bot match (called by MatchmakingService when timer expires)
function startBotMatch(io, matchId) {
  const game = matchmakingService.getGame(matchId);
  if (!game) {
    console.log(`[Match] Could not find game ${matchId} for bot match`);
    return;
  }

  // Get preferences for this match
  const preferences = game.preferences || { language: 'javascript', difficulty: 'medium' };

  // Get questions for this match's language
  game.questions = questionService.getQuestionsForMatch(QUESTIONS_PER_GAME, preferences.language);

  // Get time limit based on difficulty
  const timeLimit = questionService.getTimeLimit(preferences.difficulty);
  game.questionTimeLimit = timeLimit * 1000; // Convert to milliseconds

  // Create Socket.io room (only for human player, bots don't need sockets)
  const players = Array.from(game.players.values());
  players.forEach(player => {
    if (!player.isBot) {
      const socket = io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.join(`match-${matchId}`);
      }
    }
  });

  // Notify all human players match found
  io.to(`match-${matchId}`).emit('match_found', {
    matchId,
    players: players.map(p => ({
      id: p.id,
      username: p.username
    })),
    preferences
  });

  // Start game after countdown
  setTimeout(() => {
    startGame(io, matchId, game);
  }, GAME_START_COUNTDOWN);
}

module.exports = {
  registerHandlers,
  handleDisconnect,
  getActiveGamesCount,
  getQueueSize,
  startBotMatch
};
