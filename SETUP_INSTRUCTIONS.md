# BugHunt Live - Setup Instructions

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- npm or yarn package manager

## Initial Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bughunt_live
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Setup Database

```bash
# Create database
createdb bughunt_live

# Run initial schema
psql -U postgres -d bughunt_live -f database/schema.sql

# Run player profiles migration
psql -U postgres -d bughunt_live -f database/migrations/001_add_player_profiles.sql

# OR use the migration script
node scripts/run-migration.js
```

## Running the Application

### Start Backend (Port 3000)

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Start Frontend (Port 5173)

```bash
cd client
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## Features

### Game Modes

1. **Practice Mode** (Solo)
   - No authentication required
   - Client-side scoring
   - No database persistence
   - Perfect for learning

2. **Multiplayer Mode** (2-4 players)
   - Real-time Socket.io gameplay
   - Anonymous player profiles (no email/password)
   - Persistent stats and match history
   - Rank progression system
   - Global leaderboard

### Player Profiles (Multiplayer Only)

- **Anonymous Identity**: No email or password required
- **Session Persistence**: Profile token stored in localStorage
- **Auto-Restore**: Profile automatically restored on return
- **Stats Tracked**:
  - Total matches played
  - Wins and placements
  - Total score, best score, average score
  - Rank badge (Intern → Staff Engineer)
- **Match History**: Last 10 multiplayer games

### Rank Badges

| Total Score | Rank |
|-------------|------|
| 0 - 499 | Intern 🔰 |
| 500 - 1499 | Junior Engineer ✨ |
| 1500 - 2999 | Mid-Level Engineer 💫 |
| 3000 - 4999 | Senior Engineer ⭐ |
| 5000+ | Staff Engineer 🌟 |

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `GET /api/stats` - Server stats (active games, queue size)

### Leaderboard

- `GET /api/leaderboard?limit=50` - Global leaderboard by total score
- `GET /api/leaderboard/top-scores?limit=50` - Top single-game scores
- `GET /api/player/:username` - Stats for specific username

### Practice Mode

- `GET /api/practice/questions?count=5` - Get random questions
- `POST /api/practice/check-answer` - Validate answer

### Player Profiles

- `GET /api/profile/:id` - Get profile with match history
- `POST /api/profile/restore` - Restore profile by token

## Socket.io Events

### Client → Server

- `join_queue` - Join matchmaking queue
  ```js
  { username: 'Player123', profileToken: 'abc...' }
  ```
- `leave_queue` - Leave matchmaking queue
- `submit_answer` - Submit answer to question
  ```js
  { questionId: 'q1', answerId: 'a' }
  ```

### Server → Client

- `queue_joined` - Queue confirmation
  ```js
  { position: 1, playersWaiting: 3, playerId: 'uuid', profileToken: '...' }
  ```
- `match_found` - Match created
- `game_start` - Game starting
- `question` - New question
- `answer_result` - Answer feedback
- `round_scores` - Scoreboard update
- `game_end` - Game over
- `player_left` - Player disconnected
- `error` - Error message

## Project Structure

```
bughunt-live/
├── src/                    # Backend source
│   ├── config/
│   │   └── database.js     # Database connection + queries
│   ├── data/
│   │   └── questions.json  # 20 bug-finding questions
│   ├── handlers/
│   │   └── gameHandlers.js # Socket.io game logic
│   ├── services/
│   │   ├── MatchmakingService.js
│   │   └── QuestionService.js
│   └── server.js           # Express + Socket.io server
├── database/
│   ├── schema.sql          # Initial schema
│   └── migrations/
│       └── 001_add_player_profiles.sql
├── client/                 # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Lobby.jsx
│   │   │   ├── Game.jsx
│   │   │   ├── PracticeGame.jsx
│   │   │   ├── GameOver.jsx
│   │   │   └── Profile.jsx
│   │   ├── utils/
│   │   │   └── socket.js
│   │   ├── styles/
│   │   │   └── App.css
│   │   └── App.jsx
│   └── package.json
└── package.json

```

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
# macOS (Homebrew)
brew services restart postgresql@14

# Linux
sudo systemctl restart postgresql
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### CORS Errors

Make sure CLIENT_URL in `.env` matches your frontend URL:
```env
CLIENT_URL=http://localhost:5173
```

### Profile Not Persisting

Check localStorage in browser DevTools:
```javascript
// Should have these keys:
localStorage.getItem('bughunt_player_id');
localStorage.getItem('bughunt_profile_token');
localStorage.getItem('bughunt_username');
```

## Development

### Adding New Questions

Edit `src/data/questions.json`:

```json
{
  "id": "q21",
  "code": "// Your buggy code here",
  "question": "What's the bug?",
  "choices": [
    { "id": "a", "text": "Option A" },
    { "id": "b", "text": "Option B" },
    { "id": "c", "text": "Option C" },
    { "id": "d", "text": "Option D" }
  ],
  "correctAnswer": "b",
  "explanation": "Explanation of the bug"
}
```

### Adjusting Rank Thresholds

Edit `database/migrations/001_add_player_profiles.sql`:

```sql
CREATE OR REPLACE FUNCTION calculate_rank_badge(total_score INTEGER) RETURNS VARCHAR(20) AS $$
BEGIN
    IF total_score >= 10000 THEN  -- Adjust thresholds here
        RETURN 'Staff Engineer';
    ELSIF total_score >= 5000 THEN
        RETURN 'Senior Engineer';
    -- ...
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

Then re-run the migration.

## Documentation

- [PRACTICE_MODE.md](./PRACTICE_MODE.md) - Practice mode implementation details
- [ANONYMOUS_PROFILES.md](./ANONYMOUS_PROFILES.md) - Player profiles system guide
- [DATABASE.md](./DATABASE.md) - Database schema documentation (if exists)
- [LEADERBOARD_SUMMARY.md](./LEADERBOARD_SUMMARY.md) - Leaderboard implementation (if exists)

## Support

For issues or questions:
- Check troubleshooting section above
- Review relevant documentation files
- Check server logs: `tail -f /tmp/server.log` (if running in background)
- Check browser console for frontend errors
