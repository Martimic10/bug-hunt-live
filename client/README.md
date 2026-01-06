# BugHunt Live - Frontend

React + Vite frontend for the BugHunt Live multiplayer game.

## Tech Stack

- **React** - UI library
- **Vite** - Build tool and dev server
- **Socket.io Client** - Real-time communication
- **Plain CSS** - Dark theme styling

## Quick Start

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Ensure Backend is Running

The frontend connects to the backend at `http://localhost:3000`. Make sure the backend server is running first.

```bash
# In the root directory
npm run dev
```

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── Lobby.jsx          # Matchmaking & queue
│   │   ├── Game.jsx            # Main game screen
│   │   ├── Scoreboard.jsx      # Live scores during game
│   │   └── GameOver.jsx        # Final results
│   ├── utils/
│   │   └── socket.js           # Socket.io client setup
│   ├── styles/
│   │   └── App.css             # All styles (dark theme)
│   ├── App.jsx                 # Main app component
│   └── main.jsx                # Entry point
├── index.html
├── vite.config.js
└── package.json
```

## How It Works

### State Management

The app uses React's `useState` hook in `App.jsx` to manage all game state:

- **Game states**: `username` → `lobby` → `waiting` → `playing` → `game-over`
- **Socket events** are handled in `App.jsx` and state is passed to components as props
- No Redux/Zustand - simple prop drilling for this MVP

### Socket.io Integration

All Socket.io logic is centralized in [src/utils/socket.js](src/utils/socket.js):

**Client → Server Events:**
- `joinQueue(username)` - Join matchmaking
- `leaveQueue()` - Leave queue
- `submitAnswer(answerId, questionId)` - Submit answer

**Server → Client Events:**
- `queue_joined` - Queue confirmation
- `match_found` - Match created with players
- `game_start` - Game starting countdown
- `question` - New question received
- `answer_result` - Answer feedback
- `round_scores` - Leaderboard update
- `game_end` - Final results
- `player_left` - Player disconnected
- `error` - Error occurred

### Component Flow

1. **Lobby.jsx**
   - Username entry form
   - Queue status (waiting for players)
   - Match found screen (shows all players)

2. **Game.jsx**
   - Question display with code snippet
   - Multiple choice answers
   - Countdown timer
   - Answer submission
   - Real-time feedback
   - Embedded scoreboard (right sidebar)

3. **Scoreboard.jsx**
   - Live player rankings
   - Updates after each question
   - Highlights current player

4. **GameOver.jsx**
   - Winner announcement
   - Final leaderboard
   - Player stats (rank, score)
   - Play again button

### State Flow Example

```javascript
// 1. User joins queue
joinQueue(username)
  ↓
// 2. Backend responds
onQueueJoined({ position: 1, playersWaiting: 1 })
  ↓
// 3. Match found
onMatchFound({ matchId: '...', players: [...] })
  ↓
// 4. Game starts
onGameStart({ totalQuestions: 5, questionTimeLimit: 30 })
  ↓
// 5. Question received
onQuestion({ id, code, question, choices, ... })
  ↓
// 6. User submits answer
submitAnswer(answerId, questionId)
  ↓
// 7. Answer result
onAnswerResult({ correct: true, correctAnswer: 'a', explanation: '...' })
  ↓
// 8. Scores update
onRoundScores({ scores: [...] })
  ↓
// 9. Repeat steps 5-8 for all questions
  ↓
// 10. Game ends
onGameEnd({ finalScores: [...], winner: {...} })
```

## Styling

Dark theme CSS with:
- CSS variables for colors and spacing
- Clean, minimal design
- Responsive grid layout
- Simple transitions
- No animations beyond spinner and pulse effects

**Color scheme:**
- Background: `#0d1117` (dark)
- Cards: `#161b22`
- Borders: `#30363d`
- Accent: `#58a6ff` (blue)
- Success: `#3fb950` (green)
- Error: `#f85149` (red)

## Building for Production

```bash
npm run build
```

Output in `dist/` directory.

Preview production build:

```bash
npm run preview
```

## Environment Variables

Create `.env` file if you need to override defaults:

```bash
VITE_SOCKET_URL=http://localhost:3000
```

## Testing with Backend

1. Start backend: `npm run dev` (from root)
2. Start frontend: `npm run dev` (from client)
3. Open `http://localhost:5173` in multiple browser tabs
4. Enter different usernames and join queue
5. Play the game!

## Common Issues

**Frontend can't connect to backend:**
- Ensure backend is running on port 3000
- Check CORS settings in backend allow `http://localhost:5173`

**Socket disconnects:**
- Check browser console for errors
- Verify backend is running
- Check network tab in DevTools

**Game state stuck:**
- Refresh the page (state resets on mount)
- Check backend logs for errors

## Next Steps

- Add loading states for better UX
- Add sound effects
- Add animations for transitions
- Add mobile responsive design
- Add toast notifications
- Add game statistics/history
- Add practice mode (single player)
- Add chat during game

## License

MIT
