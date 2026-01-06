# Frontend Architecture

## Overview

Simple, centralized React architecture optimized for real-time multiplayer gameplay.

## Design Principles

1. **Centralized State** - All state in App.jsx, passed down as props
2. **Centralized Socket Logic** - All Socket.io in socket.js utility
3. **Component Simplicity** - Functional components, presentational focus
4. **No Over-Engineering** - No Redux, no complex routing, no unnecessary abstractions

## State Management Strategy

### Why No State Library?

For this MVP:
- Only **one active screen** at a time (lobby OR game OR game-over)
- State is **linear** (username → lobby → game → results)
- No complex cross-component sharing needed
- React hooks + prop drilling is sufficient

### State Location

All state lives in **App.jsx**:

```javascript
// Global navigation
const [gameState, setGameState] = useState('username')

// Player data
const [username, setUsername] = useState('')
const [players, setPlayers] = useState([])

// Game data
const [currentQuestion, setCurrentQuestion] = useState(null)
const [scores, setScores] = useState([])
const [finalScores, setFinalScores] = useState([])
```

### Component Communication

```
App.jsx (state owner)
  ├─> Lobby.jsx (receives: gameState, username, etc.)
  ├─> Game.jsx (receives: currentQuestion, scores, etc.)
  │     └─> Scoreboard.jsx (receives: scores, username)
  └─> GameOver.jsx (receives: finalScores, winner)
```

## Socket.io Architecture

### Singleton Pattern

`socket.js` exports a **single socket instance**:

```javascript
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
  }
  return socket;
};
```

**Why?** Prevents multiple connections, ensures consistent state.

### Event Registration Pattern

All events registered **once** in App.jsx's `useEffect`:

```javascript
useEffect(() => {
  connectSocket();

  // Register all listeners
  onMatchFound((data) => { ... });
  onGameStart((data) => { ... });
  onQuestion((data) => { ... });

  // Cleanup on unmount
  return () => {
    removeAllListeners('match_found');
    removeAllListeners('game_start');
    // ...
  };
}, []);
```

**Why?**
- Listeners persist across component re-renders
- Cleanup prevents memory leaks
- Centralized event handling (not scattered across components)

### Event Flow

```
User Action (component)
  ↓
Emit Event (socket.js)
  ↓
Backend Processing
  ↓
Receive Event (App.jsx listener)
  ↓
Update State (setState)
  ↓
Re-render Components (React)
```

## Component Responsibilities

### App.jsx - Controller

**Owns:**
- All game state
- Socket event listeners
- Screen navigation logic

**Does NOT:**
- Render UI directly (delegates to components)
- Handle user input (components do that)

### Lobby.jsx - Presentation + Form

**Owns:**
- Username input form state
- Queue UI rendering

**Receives:**
- Game state (username/lobby/waiting)
- Queue data (position, players)
- State setters (to update parent)

**Emits:**
- `join_queue` when user submits username
- `leave_queue` when user cancels

### Game.jsx - Presentation + Timer

**Owns:**
- Timer countdown (local state)
- Selected answer (local state)

**Receives:**
- Current question data
- Scores for scoreboard
- Answer feedback

**Emits:**
- `submit_answer` when user answers

**Why local state?**
- Timer and answer selection are **transient** (reset each question)
- No need to lift to App.jsx

### Scoreboard.jsx - Pure Presentation

**Receives:**
- Scores array
- Current username (to highlight)

**Does:**
- Sorts and renders scores
- Highlights current player

**No state, no side effects** - just renders props.

### GameOver.jsx - Pure Presentation

**Receives:**
- Final scores
- Winner data
- Reset callback

**Does:**
- Displays results
- Handles "Play Again" button

**No socket logic** - just presentation.

## Data Flow Examples

### Example 1: Joining Queue

```
1. User enters username in Lobby.jsx
2. Clicks "Join Matchmaking"
3. Lobby.jsx calls joinQueue(username)
4. socket.js emits 'join_queue' event
5. Backend adds player to queue
6. Backend emits 'queue_joined' event
7. App.jsx listener receives event
8. App.jsx updates state: setGameState('lobby')
9. React re-renders, shows queue screen
```

### Example 2: Receiving Question

```
1. Backend emits 'question' event
2. App.jsx listener receives question data
3. App.jsx updates: setCurrentQuestion(data)
4. React re-renders Game.jsx with new question
5. Game.jsx resets timer and answer state
6. User sees new question on screen
```

### Example 3: Submitting Answer

```
1. User clicks answer in Game.jsx
2. Game.jsx updates local state: setSelectedAnswer(id)
3. User clicks "Submit Answer"
4. Game.jsx calls submitAnswer(answerId, questionId)
5. socket.js emits 'submit_answer' event
6. Game.jsx updates local state: setAnswerSubmitted(true)
7. Backend processes answer
8. Backend emits 'answer_result' event
9. App.jsx listener receives result
10. App.jsx updates: setAnswerFeedback(data)
11. React re-renders Game.jsx with feedback
12. User sees correct/incorrect message
```

## Why This Architecture?

### ✅ Pros

- **Simple** - Easy to understand, no magic
- **Debuggable** - All state in one place
- **Predictable** - Linear state flow
- **Fast to build** - No boilerplate
- **Easy to maintain** - Clear data flow

### ⚠️ When to Refactor

If you add:
- Multiple simultaneous games
- Persistent player profiles
- Complex chat system
- Game history/replays
- Settings/preferences

**Then** consider:
- Context API for user data
- React Query for server state
- Local storage for persistence

But for **this MVP**, current architecture is perfect.

## Performance Considerations

### Why No Memoization?

- Component tree is **shallow** (max 3 levels)
- Re-renders are **infrequent** (only on socket events)
- No expensive calculations
- No large lists (max 4 players)

**Premature optimization avoided.**

### When to Add Optimization

If you notice:
- Lag during gameplay
- Slow re-renders in DevTools profiler
- High CPU usage

**Then** add:
- `React.memo()` on Scoreboard
- `useMemo()` for score sorting
- `useCallback()` for event handlers

## Testing Strategy

### Unit Tests (if needed)

- `socket.js` - Test event emission
- Components - Test rendering with props
- Timer logic - Test countdown

### Integration Tests

- Full game flow from lobby to game-over
- Socket event handling
- State transitions

### Manual Testing

1. Open 4 browser tabs
2. Join queue with different usernames
3. Play through full game
4. Verify all screens work
5. Test disconnection scenarios

## Security Notes

### No Authentication

- Guest usernames only (MVP)
- No password storage
- No user sessions

### Input Validation

- Username length check (client-side)
- Backend should validate all inputs
- Prevent XSS in username display

### Socket Security

- Backend should validate all events
- Rate limiting on answer submission
- Prevent cheating (client can't see correct answers until submitted)

## Future Enhancements

### Easy Additions (No Refactor Needed)

- Sound effects
- CSS animations
- Toast notifications
- Player avatars
- Chat messages

### Medium Additions (Minor Refactor)

- Multiple game modes (new components)
- Power-ups (extend game state)
- Leaderboard page (new route)

### Major Additions (Requires Refactor)

- User accounts (add auth + Context)
- Private rooms (add room management)
- Game replays (add state history)
- Tournaments (add bracket system)

## Conclusion

This architecture prioritizes:
1. **Speed of development**
2. **Ease of understanding**
3. **Maintainability**

It's deliberately simple because **simple is better for MVPs**.

As the product grows, refactor incrementally based on **real needs**, not hypothetical ones.
