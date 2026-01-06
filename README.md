# BugHunt Live - Backend

Real-time multiplayer browser game where players compete to find bugs in code.

## Tech Stack

- Node.js + Express
- Socket.io (real-time communication)
- PostgreSQL (match history & leaderboards)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```bash
# Create PostgreSQL database
createdb bughunt_live

# Run schema
psql bughunt_live < database/schema.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check
- `GET /api/stats` - Server statistics (active games, queue size)

### Socket.io Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_queue` | `{ username: string }` | Join matchmaking |
| `leave_queue` | `{}` | Leave queue |
| `submit_answer` | `{ answerId: string, questionId: string }` | Submit answer |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `queue_joined` | `{ position: number, playersWaiting: number }` | Queue confirmation |
| `match_found` | `{ matchId: string, players: Player[] }` | Match created |
| `game_start` | `{ totalQuestions: number, questionTimeLimit: number }` | Game starting |
| `question` | `{ id, code, question, choices, questionNumber, totalQuestions }` | New question |
| `answer_result` | `{ correct: boolean, correctAnswer: string, explanation: string }` | Answer feedback |
| `round_scores` | `{ scores: Score[] }` | Leaderboard update |
| `game_end` | `{ finalScores: Score[], winner: Player }` | Match finished |
| `player_left` | `{ playerId: string, username: string }` | Player disconnected |
| `error` | `{ message: string }` | Error occurred |

## Game Flow

1. **Matchmaking**: Players join queue → Match starts when 2-4 players ready
2. **Game Start**: 3-second countdown
3. **Questions**: 5 questions per game, 30 seconds each
4. **Scoring**: 100 points per correct answer
5. **End**: Leaderboard shown, match saved to database

## Project Structure

```
src/
├── server.js                  # Express + Socket.io setup
├── config/
│   └── database.js           # PostgreSQL connection
├── handlers/
│   └── gameHandlers.js       # Socket event handlers
├── services/
│   ├── MatchmakingService.js # Room/lobby logic
│   └── QuestionService.js    # Question delivery
└── data/
    └── questions.json        # Bug hunt questions
```

## Adding Questions

Edit [src/data/questions.json](src/data/questions.json):

```json
{
  "id": "q9",
  "code": "// Your buggy code here",
  "question": "What's the bug?",
  "choices": [
    { "id": "a", "text": "Option A" },
    { "id": "b", "text": "Option B" },
    { "id": "c", "text": "Option C" },
    { "id": "d", "text": "Option D" }
  ],
  "correctAnswer": "a",
  "explanation": "Why A is correct"
}
```

## Testing

```bash
# Start server
npm run dev

# In another terminal, test with curl
curl http://localhost:3000/health
curl http://localhost:3000/api/stats
```

For Socket.io testing, build a simple HTML client or use the React frontend.

## Database Queries

```sql
-- Get leaderboard
SELECT username, final_score, matches.ended_at
FROM match_players
JOIN matches ON match_players.match_id = matches.id
WHERE matches.status = 'completed'
ORDER BY final_score DESC
LIMIT 10;

-- Get player match history
SELECT matches.id, final_score, rank, matches.ended_at
FROM match_players
JOIN matches ON match_players.match_id = matches.id
WHERE player_id = 'uuid-here'
ORDER BY matches.ended_at DESC;
```

## Environment Variables

```bash
PORT=3000                          # Server port
DATABASE_URL=postgresql://...      # PostgreSQL connection
CLIENT_URL=http://localhost:5173   # Frontend URL (for CORS)
NODE_ENV=development               # Environment
```

## Next Steps

- Build React frontend
- Add more question categories
- Implement ELO rating system
- Add private rooms
- Implement power-ups/bonuses for speed

## License

MIT
