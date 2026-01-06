/**
 * BotService - Manages bot players for multiplayer matches
 *
 * Bots are used to fill matches when there aren't enough human players,
 * ensuring paying customers can play immediately without waiting.
 */

class BotService {
  constructor() {
    // Pool of bot names with programming themes
    this.botNames = [
      'CodeWizard', 'BugSlayer', 'DebugMaster', 'SyntaxNinja',
      'CompilerBot', 'AlgoExpert', 'StackOverflow', 'GitGuru',
      'RefactorKing', 'TestDriven', 'LintLord', 'MergeQueen',
      'CommitBot', 'PullRequest', 'HotfixHero', 'PatchPro',
      'VersionVault', 'BranchBoss', 'CodeReview', 'DeployDrone',
      'CICDBot', 'JenkinsJr', 'DockerDude', 'KubeKnight',
      'CloudCoder', 'ServerSage', 'APIAce', 'JSONJockey',
      'RegexRanger', 'LoopLegend', 'RecursiveRick', 'AsyncAnna',
      'PromiseBot', 'CallbackCarl', 'ClosureClaire', 'ScopeScout'
    ];

    this.usedBotNames = new Set();
    this.activeBots = new Map(); // matchId -> [bot objects]
  }

  /**
   * Generate a unique bot player for a match
   */
  createBot(matchId) {
    // Get available bot names (not currently in use)
    const availableNames = this.botNames.filter(name => !this.usedBotNames.has(name));

    // If all names are in use, reuse them with numbers
    let botName;
    if (availableNames.length > 0) {
      botName = availableNames[Math.floor(Math.random() * availableNames.length)];
    } else {
      botName = this.botNames[Math.floor(Math.random() * this.botNames.length)] + Math.floor(Math.random() * 100);
    }

    this.usedBotNames.add(botName);

    const bot = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      socketId: `bot_socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: botName,
      isBot: true,
      matchId: matchId,
      // Bot skill level determines accuracy (0.5 = 50% correct, 0.9 = 90% correct)
      skillLevel: 0.4 + Math.random() * 0.5, // Random between 40% and 90% accuracy
      // Response time range in ms (faster bots answer quicker)
      minResponseTime: 2000 + Math.random() * 3000, // 2-5 seconds minimum
      maxResponseTime: 8000 + Math.random() * 7000  // 8-15 seconds maximum
    };

    // Track active bots per match
    if (!this.activeBots.has(matchId)) {
      this.activeBots.set(matchId, []);
    }
    this.activeBots.get(matchId).push(bot);

    return bot;
  }

  /**
   * Generate multiple bots to fill a match
   * @param {string} matchId - The match ID
   * @param {number} count - Number of bots needed
   */
  createBots(matchId, count) {
    const bots = [];
    for (let i = 0; i < count; i++) {
      bots.push(this.createBot(matchId));
    }
    return bots;
  }

  /**
   * Determine if bot should answer correctly based on skill level
   * @param {object} bot - The bot object
   * @returns {boolean} - True if bot should answer correctly
   */
  shouldAnswerCorrectly(bot) {
    return Math.random() < bot.skillLevel;
  }

  /**
   * Get a random response time for the bot
   * @param {object} bot - The bot object
   * @returns {number} - Response time in milliseconds
   */
  getResponseTime(bot) {
    return bot.minResponseTime + Math.random() * (bot.maxResponseTime - bot.minResponseTime);
  }

  /**
   * Get bot's answer for a question
   * @param {object} bot - The bot object
   * @param {object} question - The question object with choices
   * @param {string} correctAnswerId - The correct answer ID
   * @returns {string} - The chosen answer ID
   */
  getBotAnswer(bot, question, correctAnswerId) {
    const answerCorrectly = this.shouldAnswerCorrectly(bot);

    if (answerCorrectly) {
      return correctAnswerId;
    } else {
      // Choose a random wrong answer
      const wrongChoices = question.choices
        .map(choice => choice.id)
        .filter(id => id !== correctAnswerId);

      return wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    }
  }

  /**
   * Simulate bot answering a question
   * @param {object} bot - The bot object
   * @param {object} question - The question object
   * @param {string} correctAnswerId - The correct answer ID
   * @param {function} submitCallback - Callback to submit the answer
   */
  simulateBotAnswer(bot, question, correctAnswerId, submitCallback) {
    const responseTime = this.getResponseTime(bot);
    const answerId = this.getBotAnswer(bot, question, correctAnswerId);

    // Schedule bot answer after response time
    setTimeout(() => {
      submitCallback(bot, question.id, answerId);
    }, responseTime);
  }

  /**
   * Clean up bots after match ends
   * @param {string} matchId - The match ID
   */
  cleanupBots(matchId) {
    const bots = this.activeBots.get(matchId);
    if (bots) {
      // Release bot names for reuse
      bots.forEach(bot => {
        this.usedBotNames.delete(bot.username);
      });
      this.activeBots.delete(matchId);
    }
  }

  /**
   * Get all active bots for a match
   * @param {string} matchId - The match ID
   * @returns {Array} - Array of bot objects
   */
  getBotsForMatch(matchId) {
    return this.activeBots.get(matchId) || [];
  }

  /**
   * Check if a player is a bot
   * @param {string} playerId - The player ID
   * @returns {boolean} - True if player is a bot
   */
  isBot(playerId) {
    return playerId.startsWith('bot_');
  }
}

// Singleton instance
const botService = new BotService();

module.exports = botService;
