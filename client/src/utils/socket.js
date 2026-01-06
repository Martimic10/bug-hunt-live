import { io } from 'socket.io-client';

// Initialize socket connection to backend
// Backend runs on http://localhost:3000
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket = null;

/**
 * Get or create socket instance (singleton pattern)
 * @returns {Socket} Socket.io client instance
 */
export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false, // Manual connection control
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  }
  return socket;
};

/**
 * Connect to Socket.io server
 */
export const connectSocket = () => {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
};

/**
 * Disconnect from Socket.io server
 */
export const disconnectSocket = () => {
  const socket = getSocket();
  if (socket.connected) {
    socket.disconnect();
  }
};

/**
 * CLIENT → SERVER EVENTS
 * Functions to emit events to backend
 */

// Join matchmaking queue
export const joinQueue = (username, profileToken = null, playerId = null) => {
  const socket = getSocket();
  socket.emit('join_queue', { username, profileToken, playerId });
};

// Leave matchmaking queue
export const leaveQueue = () => {
  const socket = getSocket();
  socket.emit('leave_queue', {});
};

// Submit answer to current question
export const submitAnswer = (answerId, questionId) => {
  const socket = getSocket();
  socket.emit('submit_answer', { answerId, questionId });
};

/**
 * SERVER → CLIENT EVENT LISTENERS
 * Register callbacks for backend events
 */

// Queue joined confirmation
export const onQueueJoined = (callback) => {
  const socket = getSocket();
  socket.on('queue_joined', callback);
};

// Match found - game about to start
export const onMatchFound = (callback) => {
  const socket = getSocket();
  socket.on('match_found', callback);
};

// Game starting
export const onGameStart = (callback) => {
  const socket = getSocket();
  socket.on('game_start', callback);
};

// New question received
export const onQuestion = (callback) => {
  const socket = getSocket();
  socket.on('question', callback);
};

// Answer result feedback
export const onAnswerResult = (callback) => {
  const socket = getSocket();
  socket.on('answer_result', callback);
};

// Round scores update (leaderboard)
export const onRoundScores = (callback) => {
  const socket = getSocket();
  socket.on('round_scores', callback);
};

// Game ended
export const onGameEnd = (callback) => {
  const socket = getSocket();
  socket.on('game_end', callback);
};

// Player disconnected
export const onPlayerLeft = (callback) => {
  const socket = getSocket();
  socket.on('player_left', callback);
};

// Error occurred
export const onError = (callback) => {
  const socket = getSocket();
  socket.on('error', callback);
};

// Connection status events
export const onConnect = (callback) => {
  const socket = getSocket();
  socket.on('connect', callback);
};

export const onDisconnect = (callback) => {
  const socket = getSocket();
  socket.on('disconnect', callback);
};

/**
 * Remove event listeners
 */
export const removeListener = (eventName, callback) => {
  const socket = getSocket();
  socket.off(eventName, callback);
};

export const removeAllListeners = (eventName) => {
  const socket = getSocket();
  socket.off(eventName);
};
