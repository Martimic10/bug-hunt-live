# Anonymous Player Profiles - Implementation Guide

## Overview

BugHunt Live now supports **persistent anonymous player profiles** for multiplayer mode without requiring authentication, email, or passwords. Players get a persistent identity across sessions using a secure token stored in localStorage.

## How It Works

### Anonymous Identity System

1. **First-time Player**:
   - Player joins multiplayer for the first time
   - Backend generates a unique `player_id` (UUID) and `profile_token` (64-char hex)
   - Frontend stores both in localStorage
   - Profile is automatically created in the database

2. **Returning Player**:
   - Frontend reads `profile_token` from localStorage
   - Sends token when joining queue
   - Backend validates token and restores player profile
   - Stats and history are preserved

3. **Profile Persistence**:
   - LocalStorage keys:
     - `bughunt_player_id` - Player UUID
     - `bughunt_profile_token` - Session token (64-char hex)
     - `bughunt_username` - Last used username
   - Profiles persist indefinitely (no expiration)
   - Clearing localStorage = losing profile (by design for MVP)

## Database Schema

### Players Table (Extended)

```sql
ALTER TABLE players ADD COLUMN profile_token VARCHAR(64) UNIQUE;
ALTER TABLE players ADD COLUMN total_matches INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN wins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN total_score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN best_score INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN avg_score DECIMAL(10,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN rank_badge VARCHAR(20) DEFAULT 'Intern';
ALTER TABLE players ADD COLUMN last_played_at TIMESTAMP;
ALTER TABLE players ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
```

### Match History Table (New)

```sql
CREATE TABLE player_match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    placement INTEGER NOT NULL, -- 1st, 2nd, 3rd, 4th
    score INTEGER NOT NULL,
    total_players INTEGER NOT NULL,
    played_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, match_id)
);
```

**Keeps last 10 matches per player automatically.**

### Rank Badges

Rank badges are calculated based on total_score:

| Total Score | Rank Badge |
|-------------|------------|
| 0 - 499     | Intern 🔰 |
| 500 - 1499  | Junior Engineer ✨ |
| 1500 - 2999 | Mid-Level Engineer 💫 |
| 3000 - 4999 | Senior Engineer ⭐ |
| 5000+       | Staff Engineer 🌟 |

## Backend Implementation

### Database Functions

Located in: `database/migrations/001_add_player_profiles.sql`

**Key Functions:**
- `create_player_with_profile(username)` - Creates player + token
- `update_player_profile_stats(player_id)` - Recalculates all stats
- `insert_player_match_history(...)` - Adds match to history (keeps last 10)
- `calculate_rank_badge(total_score)` - Returns rank name

### API Endpoints

#### GET `/api/profile/:id`
Fetch complete player profile with match history.

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "username": "Player123",
    "totalMatches": 15,
    "wins": 5,
    "totalScore": 2500,
    "bestScore": 400,
    "avgScore": 166.67,
    "rankBadge": "Mid-Level Engineer",
    "lastPlayedAt": "2026-01-05T12:00:00Z",
    "createdAt": "2026-01-01T10:00:00Z"
  },
  "matchHistory": [
    {
      "matchId": "uuid",
      "placement": 1,
      "score": 400,
      "totalPlayers": 3,
      "playedAt": "2026-01-05T12:00:00Z"
    }
  ]
}
```

#### POST `/api/profile/restore`
Restore player session by token.

**Request:**
```json
{
  "profileToken": "64-char-hex-string"
}
```

**Response:**
```json
{
  "success": true,
  "player": {
    "id": "uuid",
    "username": "Player123",
    "profileToken": "...",
    "totalMatches": 15,
    "wins": 5,
    "rankBadge": "Mid-Level Engineer"
  }
}
```

### Socket.io Changes

**`join_queue` event** now accepts `profileToken`:

```javascript
socket.emit('join_queue', {
  username: 'Player123',
  profileToken: 'abc123...' // Optional
});
```

**`queue_joined` response** now includes profile info:

```javascript
socket.on('queue_joined', (data) => {
  // data.playerId - UUID for profile
  // data.profileToken - Token to save in localStorage
  // data.position - Queue position
  // data.playersWaiting - Total in queue
});
```

### Match End Logic

After each match ends (in `gameHandlers.js`):

```javascript
// 1. Save match to database
await db.saveMatch({...});

// 2. For each player:
for (const player of finalScores) {
  // Update profile stats (total matches, wins, scores, rank badge)
  await db.updatePlayerProfileStats(player.id);

  // Insert into match history (keeps last 10)
  await db.insertPlayerMatchHistory(
    player.id,
    matchId,
    player.username,
    player.rank, // placement
    player.score,
    finalScores.length,
    new Date()
  );
}

// 3. Refresh global leaderboard
await db.refreshLeaderboard();
```

## Frontend Implementation

### Profile Component

Located: `client/src/components/Profile.jsx`

**Features:**
- Displays rank badge with emoji
- Shows 6 key stats (total matches, wins, total score, best score, avg score, win rate)
- Lists last 10 matches with placement badges
- Responsive design
- Loading and error states

### Session Persistence

Located: `client/src/App.jsx`

**On App Mount:**
```javascript
useEffect(() => {
  const restoreProfile = async () => {
    const savedToken = localStorage.getItem('bughunt_profile_token');
    const savedPlayerId = localStorage.getItem('bughunt_player_id');

    if (savedToken && savedPlayerId) {
      // Verify token with backend
      const response = await fetch('/api/profile/restore', {
        method: 'POST',
        body: JSON.stringify({ profileToken: savedToken })
      });

      if (data.success) {
        setPlayerId(data.player.id);
        setProfileToken(data.player.profileToken);
        setUsername(data.player.username);
      }
    }
  };

  restoreProfile();
}, []);
```

**On Queue Joined:**
```javascript
onQueueJoined((data) => {
  if (data.playerId && data.profileToken) {
    // Save to localStorage
    localStorage.setItem('bughunt_player_id', data.playerId);
    localStorage.setItem('bughunt_profile_token', data.profileToken);
    localStorage.setItem('bughunt_username', username);
  }
});
```

### Profile Navigation

**View Profile Button:**
- Appears in header when `playerId` exists
- Click → Sets `gameState = 'profile'`
- Shows Profile component

**Back from Profile:**
- "← Back" button → Returns to mode select

## User Flow

### New Player

```
1. Select Multiplayer Mode
2. Enter Username
3. Click "Join Matchmaking"
   ↓
4. Backend creates:
   - Player record in DB
   - Generates profile_token
   ↓
5. Frontend receives:
   - playerId: "abc-123-uuid"
   - profileToken: "64-char-hex"
   ↓
6. Saves to localStorage:
   - bughunt_player_id
   - bughunt_profile_token
   - bughunt_username
   ↓
7. Profile button appears in header
8. Play game → Stats update automatically
```

### Returning Player

```
1. App loads
2. Reads profileToken from localStorage
3. Calls POST /api/profile/restore
   ↓
4. Backend validates token
5. Returns player data
   ↓
6. Profile restored:
   - Username pre-filled
   - Profile button visible
   - Stats preserved
   ↓
7. Player can view profile or play again
```

## Security Considerations

### ✅ What's Secure

- Profile tokens are 64-character hex (256-bit entropy)
- Tokens are unique and indexed in database
- Server-side validation on all endpoints
- SQL injection prevented (parameterized queries)
- CORS properly configured

### ⚠️ Limitations (By Design for MVP)

- **No password protection** - Anyone with the token can access the profile
- **No email recovery** - Lost localStorage = lost profile
- **No account linking** - Can't merge profiles across devices
- **No username uniqueness** - Multiple players can have same username
- **LocalStorage only** - Clearing browser data = losing profile

### Future Enhancements (Not MVP)

- Optional email linking (without requiring it)
- Multi-device sync
- Profile transfer/export
- Username reservation
- OAuth login (optional, not required)

## Practice Mode vs Multiplayer

| Feature | Practice Mode | Multiplayer Mode |
|---------|--------------|------------------|
| Profile Creation | ❌ No | ✅ Yes |
| Stats Tracking | ❌ No | ✅ Yes |
| Match History | ❌ No | ✅ Yes |
| Rank Badges | ❌ No | ✅ Yes |
| Database Writes | ❌ No | ✅ Yes |
| Profile Button | ❌ Hidden | ✅ Shown |

**Why?** Practice mode is free and lightweight. Only multiplayer creates persistent profiles.

## Testing

### Manual Testing Steps

**1. Test Profile Creation (New Player):**
```bash
# Clear localStorage first
localStorage.clear();

# Play multiplayer game
1. Select Multiplayer
2. Enter username "TestPlayer"
3. Join queue
4. Finish game
5. Check localStorage has:
   - bughunt_player_id
   - bughunt_profile_token
   - bughunt_username
6. Profile button should appear
```

**2. Test Profile Restoration (Returning Player):**
```bash
# Refresh page (without clearing localStorage)
1. Page reloads
2. Profile should auto-restore
3. Username pre-filled
4. Profile button visible
5. Click profile → See stats
```

**3. Test Match History:**
```bash
# Play 3-5 multiplayer games
1. After each game, click Profile
2. Match history should update
3. Most recent game at top
4. Placement badges correct (🥇🥈🥉)
```

**4. Test Rank Progression:**
```bash
# Play enough to gain points
# Initial: Intern (0-499 points)
# Play more games to reach:
# - Junior Engineer (500+)
# - Mid-Level Engineer (1500+)
# Check profile shows correct rank badge
```

### API Testing

```bash
# Get profile by ID
curl http://localhost:3000/api/profile/<UUID>

# Restore profile by token
curl -X POST http://localhost:3000/api/profile/restore \
  -H "Content-Type: application/json" \
  -d '{"profileToken":"abc123..."}'
```

## Migration Instructions

**IMPORTANT:** Run the database migration before starting the server.

```bash
# Option 1: Using the migration script
node scripts/run-migration.js

# Option 2: Using psql directly
psql -U postgres -d bughunt_live -f database/migrations/001_add_player_profiles.sql
```

**Verify migration:**
```sql
-- Check new columns exist
\d players

-- Check new table exists
\d player_match_history

-- Test functions
SELECT calculate_rank_badge(2500);
-- Should return: "Mid-Level Engineer"
```

## File Structure

```
Backend:
database/
├── migrations/
│   └── 001_add_player_profiles.sql (NEW)
├── schema.sql (unchanged)
src/
├── config/
│   └── database.js (MODIFIED - added profile functions)
├── handlers/
│   └── gameHandlers.js (MODIFIED - profile creation + updates)
├── services/
│   └── MatchmakingService.js (MODIFIED - accepts playerId)
└── server.js (MODIFIED - added 2 profile endpoints)

Frontend:
client/src/
├── components/
│   ├── Profile.jsx (NEW)
│   └── Lobby.jsx (MODIFIED - sends profileToken)
├── App.jsx (MODIFIED - profile state + session restore)
├── utils/
│   └── socket.js (MODIFIED - joinQueue accepts token)
└── styles/
    └── App.css (MODIFIED - profile styles added)
```

## Summary

✅ **What We Built:**
- Anonymous player profiles without auth
- Persistent identity using localStorage tokens
- Match history (last 10 games)
- Rank progression system (5 ranks)
- Profile viewing UI
- Automatic stats updates after each match

✅ **What We DIDN'T Build (By Design):**
- Email/password authentication
- OAuth login
- Username uniqueness enforcement
- Profile editing
- Settings page
- Multi-device sync
- Account recovery

This is an **MVP-level anonymous profile system** that provides the core multiplayer experience enhancement without over-engineering identity management.

**Lines of Code:**
- Database: ~200 lines (migration SQL)
- Backend: ~150 lines (API + handlers)
- Frontend: ~350 lines (Profile component + integration)
- **Total: ~700 lines**

Minimal, clean, and focused on the user experience.
