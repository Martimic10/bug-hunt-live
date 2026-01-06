# BugHunt Live - Frontend Setup Guide

## Installation

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## Prerequisites

1. **Backend must be running** on `http://localhost:3000`
2. **Node.js** version 16+ recommended

## File Structure

```
client/
├── index.html                 # HTML entry point
├── vite.config.js            # Vite configuration
├── package.json              # Dependencies
│
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Main app component (state owner)
│   │
│   ├── components/
│   │   ├── Lobby.jsx         # Username entry + matchmaking
│   │   ├── Game.jsx          # Main gameplay screen
│   │   ├── Scoreboard.jsx    # Live scores sidebar
│   │   └── GameOver.jsx      # Final results screen
│   │
│   ├── utils/
│   │   └── socket.js         # Socket.io client setup
│   │
│   └── styles/
│       └── App.css           # All styles (dark theme)
│
├── README.md                 # General documentation
├── ARCHITECTURE.md           # Architecture explanation
└── SETUP.md                  # This file
```

## Socket Events Reference

### Events You Emit (Client → Server)

| Event | Payload | When |
|-------|---------|------|
| `join_queue` | `{ username: string }` | User joins matchmaking |
| `leave_queue` | `{}` | User leaves queue |
| `submit_answer` | `{ answerId: string, questionId: string }` | User submits answer |

### Events You Listen For (Server → Client)

| Event | Payload | What It Means |
|-------|---------|---------------|
| `queue_joined` | `{ position: number, playersWaiting: number }` | Successfully joined queue |
| `match_found` | `{ matchId: string, players: Player[] }` | Match created, game starting soon |
| `game_start` | `{ totalQuestions: number, questionTimeLimit: number }` | Game is starting |
| `question` | `{ id, code, question, choices, questionNumber, totalQuestions }` | New question received |
| `answer_result` | `{ correct: boolean, correctAnswer: string, explanation: string }` | Your answer was checked |
| `round_scores` | `{ scores: Score[] }` | Updated leaderboard |
| `game_end` | `{ finalScores: Score[], winner: Player }` | Game finished |
| `player_left` | `{ playerId: string, username: string }` | Another player disconnected |
| `error` | `{ message: string }` | Something went wrong |

## Screen Flow

```
┌─────────────┐
│  USERNAME   │  User enters username
│   ENTRY     │
└──────┬──────┘
       │ Clicks "Join Matchmaking"
       ▼
┌─────────────┐
│   LOBBY     │  Waiting for players
│  (QUEUE)    │  Shows queue position
└──────┬──────┘
       │ Match found (2-4 players)
       ▼
┌─────────────┐
│   WAITING   │  Shows all players
│             │  "Game starting soon..."
└──────┬──────┘
       │ Backend starts game
       ▼
┌─────────────┐
│   PLAYING   │  Active gameplay
│             │  - Question display
│             │  - Answer choices
│             │  - Timer
│             │  - Live scoreboard
└──────┬──────┘
       │ All questions answered
       ▼
┌─────────────┐
│  GAME OVER  │  Final results
│             │  - Winner announcement
│             │  - Leaderboard
│             │  - "Play Again" button
└──────┬──────┘
       │ Clicks "Play Again"
       │
       └─────► Back to USERNAME ENTRY
```

## Component Breakdown

### App.jsx (Parent Component)

**Responsibilities:**
- Socket.io connection management
- Global state management
- Event listener registration
- Screen routing based on game state

**State:**
- `gameState` - Current screen (username/lobby/waiting/playing/game-over)
- `username` - Player's username
- `currentQuestion` - Active question data
- `scores` - Live scoreboard
- `finalScores` - End game results
- And more...

### Lobby.jsx

**What it shows:**
1. **Username screen** - Input form
2. **Queue screen** - "Finding players..." with spinner
3. **Waiting screen** - "Match found!" with player list

**Props it receives:**
- `gameState` - Which lobby screen to show
- `username` - Current username
- `players` - Players in match

### Game.jsx

**What it shows:**
- Question progress (1 of 5)
- Timer countdown
- Code snippet with bug
- Question text
- Multiple choice answers (A, B, C, D)
- Submit button
- Answer feedback (after submission)
- Embedded scoreboard (right sidebar)

**Props it receives:**
- `currentQuestion` - Question data
- `questionNumber` - Current question number
- `totalQuestions` - Total questions in game
- `scores` - For scoreboard

**Local state:**
- `timeRemaining` - Countdown timer
- `selectedAnswer` - Which choice user clicked
- `answerSubmitted` - Whether user already submitted

### Scoreboard.jsx

**What it shows:**
- Live player rankings
- Player scores
- Highlights current player
- Crown emoji for 1st place

**Props it receives:**
- `scores` - Array of player scores
- `username` - To highlight current player

### GameOver.jsx

**What it shows:**
- Winner announcement with trophy
- Your performance (rank + score)
- Final leaderboard
- "Play Again" button

**Props it receives:**
- `finalScores` - Final rankings
- `winner` - Winner data
- `username` - Current player
- `resetToLobby` - Callback to restart

## Styling Overview

All styles in [src/styles/App.css](src/styles/App.css)

**Color Palette:**
```css
--bg-primary: #0d1117      /* Page background */
--bg-secondary: #161b22    /* Card background */
--bg-tertiary: #21262d     /* Nested elements */
--border-color: #30363d    /* Borders */
--text-primary: #c9d1d9    /* Main text */
--text-secondary: #8b949e  /* Muted text */
--accent-primary: #58a6ff  /* Blue accent */
--success: #3fb950         /* Green (correct) */
--error: #f85149           /* Red (wrong) */
```

**Key Classes:**
- `.btn` - Button base
- `.btn-primary` - Main action button (blue)
- `.btn-secondary` - Secondary button (gray)
- `.lobby-card` - Centered card layout
- `.game-container` - Game grid (main + sidebar)
- `.code-block` - Code snippet display
- `.choice` - Answer choice button
- `.scoreboard-player` - Scoreboard row

## Testing

### Manual Testing Checklist

1. **Lobby Flow**
   - [ ] Can enter username
   - [ ] Username validation works (min 3 chars)
   - [ ] Queue screen shows after joining
   - [ ] Can leave queue
   - [ ] Match found screen shows all players

2. **Game Flow**
   - [ ] Questions load correctly
   - [ ] Code snippets are readable
   - [ ] Can select answers
   - [ ] Timer counts down
   - [ ] Submit button works
   - [ ] Answer feedback appears
   - [ ] Scoreboard updates after each question

3. **Game Over Flow**
   - [ ] Winner is announced
   - [ ] Final scores are correct
   - [ ] Your rank is highlighted
   - [ ] "Play Again" resets to lobby

4. **Multi-Player**
   - [ ] Open 4 browser tabs
   - [ ] Each tab can have different username
   - [ ] All tabs receive same questions
   - [ ] Scoreboard updates in real-time
   - [ ] Game ends for all players together

### Common Issues

**"Cannot connect to server"**
- Make sure backend is running on port 3000
- Check browser console for errors

**"Stuck in queue"**
- Need 2-4 players minimum
- Open multiple browser tabs to test

**"Timer not working"**
- Check browser console for errors
- Make sure question data is received

**"Styles not loading"**
- Make sure you imported `App.css` in `App.jsx`
- Check browser DevTools for CSS errors

## Development Tips

### Hot Module Replacement

Vite provides HMR out of the box. Changes to components will update instantly without full page reload.

### React DevTools

Install React DevTools browser extension to inspect:
- Component tree
- Props and state
- Re-renders

### Socket Debugging

Add this to see all socket events:

```javascript
// In App.jsx useEffect
const socket = getSocket();
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});
```

### State Debugging

Add this to App.jsx to see state changes:

```javascript
useEffect(() => {
  console.log('Game state changed:', gameState);
}, [gameState]);

useEffect(() => {
  console.log('Question changed:', currentQuestion);
}, [currentQuestion]);
```

## Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Build output goes to `dist/` directory.

## Environment Variables

Create `.env` file to override defaults:

```bash
# Backend URL (default: http://localhost:3000)
VITE_SOCKET_URL=http://localhost:3000
```

## Next Steps

1. Install dependencies: `npm install`
2. Start backend: `npm run dev` (from root directory)
3. Start frontend: `npm run dev` (from client directory)
4. Open `http://localhost:5173` in browser
5. Test the game flow!

## Additional Resources

- [README.md](README.md) - Overview and usage
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture explanation
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [Socket.io Client Documentation](https://socket.io/docs/v4/client-api/)
