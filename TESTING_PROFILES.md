# Testing Anonymous Player Profiles - Step by Step Guide

## Prerequisites

Before testing, make sure:

1. **PostgreSQL is running** and the database exists:
   ```bash
   # Check if PostgreSQL is running
   pg_isready

   # If not running, start it (macOS with Homebrew):
   brew services start postgresql@14
   ```

2. **Run the migration** (IMPORTANT - do this first!):
   ```bash
   # Option 1: Using migration script
   node scripts/run-migration.js

   # Option 2: Using psql directly
   psql -U postgres -d bughunt_live -f database/migrations/001_add_player_profiles.sql
   ```

3. **Backend server is running** on port 3000:
   ```bash
   npm run dev
   ```

4. **Frontend is running** on port 5173:
   ```bash
   cd client
   npm run dev
   ```

## Test 1: New Player - Profile Creation

This tests that a new player gets a profile created automatically.

### Steps:

1. **Clear localStorage** (to simulate a new player):
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run:
     ```javascript
     localStorage.clear();
     location.reload();
     ```

2. **Play a multiplayer game**:
   - Select **Multiplayer** mode
   - Enter username: `TestPlayer1`
   - Click "Join Matchmaking"
   - Wait for match (or open another browser tab/window to join as player 2)
   - Play through the game

3. **Verify profile was created**:
   - Open DevTools → Console
   - Run:
     ```javascript
     console.log('Player ID:', localStorage.getItem('bughunt_player_id'));
     console.log('Profile Token:', localStorage.getItem('bughunt_profile_token'));
     console.log('Username:', localStorage.getItem('bughunt_username'));
     ```

   **Expected Result:**
   - All three values should be present
   - `player_id` should be a UUID (e.g., `abc123-def456-...`)
   - `profile_token` should be a 64-character hex string
   - `username` should be `TestPlayer1`

4. **Verify Profile Button appears**:
   - After the game, you should see a "👤 Profile" button in the header
   - Click it to view your profile

5. **Check profile data**:
   - Should show:
     - Username: `TestPlayer1`
     - Rank: `Intern 🔰`
     - Total Matches: `1`
     - Wins: `1` (if you won) or `0`
     - Score matches your game score
   - Match history should show 1 entry with your placement

## Test 2: Returning Player - Session Restoration

This tests that the profile persists across browser refreshes.

### Steps:

1. **Keep localStorage intact** (don't clear it)

2. **Refresh the page**:
   - Press F5 or Cmd+R to reload

3. **Check profile restored**:
   - Open DevTools → Console
   - You should see: `Profile restored: TestPlayer1`
   - Profile button should be visible immediately
   - Click Multiplayer → username field might be pre-filled

4. **View profile**:
   - Click "👤 Profile" button
   - Should show same stats as before

5. **Play another game**:
   - Select Multiplayer
   - Enter username (can be same or different)
   - Complete the game

6. **Check updated stats**:
   - Click Profile button
   - Total Matches should now be `2`
   - Match history should show 2 entries (newest first)

## Test 3: Multiple Games - Rank Progression

This tests that stats accumulate and rank badges update.

### Steps:

1. **Play several games** (5-10 games) to accumulate points

2. **Check rank progression**:

   After each game, click Profile and watch your rank change:

   | Total Score | Rank Badge |
   |-------------|------------|
   | 0-499 | Intern 🔰 |
   | 500-1499 | Junior Engineer ✨ |
   | 1500-2999 | Mid-Level Engineer 💫 |
   | 3000-4999 | Senior Engineer ⭐ |
   | 5000+ | Staff Engineer 🌟 |

3. **Verify stats**:
   - Total Matches increases
   - Total Score accumulates
   - Best Score shows your highest game
   - Avg Score calculates correctly
   - Win Rate shows percentage

4. **Check match history**:
   - Last 10 games shown (newest first)
   - Each entry shows:
     - Placement badge (🥇 🥈 🥉 or #4)
     - Score
     - Number of players
     - Date/time

## Test 4: Match History Limit

This tests that only the last 10 matches are kept.

### Steps:

1. **Play 12+ multiplayer games**

2. **Check match history**:
   - Click Profile
   - Should only show 10 most recent matches
   - Oldest matches should be automatically removed

## Test 5: Multi-Device/Browser (Profile Isolation)

This tests that profiles are isolated per browser/device.

### Steps:

1. **In Browser 1** (e.g., Chrome):
   - Play as `Player1`
   - Check localStorage has profile token

2. **In Browser 2** (e.g., Firefox or Chrome Incognito):
   - Play as `Player2`
   - Should get a DIFFERENT profile token
   - Completely separate profile

3. **Verify isolation**:
   - Each browser has its own profile
   - Clearing localStorage in one doesn't affect the other

## Test 6: Lost Profile (Clear localStorage)

This tests what happens when a user loses their profile.

### Steps:

1. **Have a profile with stats** (play a few games)

2. **Clear localStorage**:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

3. **Try to play again**:
   - Profile button should disappear
   - Play a multiplayer game
   - New profile will be created
   - Old profile is still in database but inaccessible

**Expected:** This is by design - no recovery mechanism for MVP.

## Test 7: API Endpoints

Test the backend API directly.

### Get Profile by ID:

```bash
# Replace UUID with your actual player_id from localStorage
curl http://localhost:3000/api/profile/YOUR-PLAYER-UUID-HERE
```

**Expected Response:**
```json
{
  "success": true,
  "profile": {
    "id": "...",
    "username": "TestPlayer1",
    "totalMatches": 5,
    "wins": 2,
    "totalScore": 1200,
    "bestScore": 300,
    "avgScore": 240,
    "rankBadge": "Junior Engineer",
    "lastPlayedAt": "...",
    "createdAt": "..."
  },
  "matchHistory": [...]
}
```

### Restore Profile by Token:

```bash
# Replace TOKEN with your actual profile_token from localStorage
curl -X POST http://localhost:3000/api/profile/restore \
  -H "Content-Type: application/json" \
  -d '{"profileToken":"YOUR-TOKEN-HERE"}'
```

**Expected Response:**
```json
{
  "success": true,
  "player": {
    "id": "...",
    "username": "TestPlayer1",
    "profileToken": "...",
    "totalMatches": 5,
    "wins": 2,
    "rankBadge": "Junior Engineer"
  }
}
```

## Test 8: Practice Mode (Should NOT Create Profile)

This verifies that practice mode doesn't create profiles.

### Steps:

1. **Clear localStorage**:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Play Practice Mode**:
   - Select Practice Mode
   - Complete a game

3. **Check localStorage**:
   ```javascript
   console.log(localStorage.getItem('bughunt_player_id')); // Should be null
   console.log(localStorage.getItem('bughunt_profile_token')); // Should be null
   ```

4. **Verify no profile button**:
   - Profile button should NOT appear after practice games
   - Only appears after multiplayer

## Test 9: Database Verification

Check the database directly.

### View All Players:

```sql
-- Connect to database
psql -U postgres -d bughunt_live

-- View all players with profiles
SELECT
  username,
  total_matches,
  wins,
  total_score,
  rank_badge,
  LEFT(profile_token, 10) || '...' as token_preview
FROM players
ORDER BY total_score DESC;
```

### View Match History:

```sql
-- Replace UUID with your player_id
SELECT
  placement,
  score,
  total_players,
  played_at
FROM player_match_history
WHERE player_id = 'YOUR-PLAYER-UUID'
ORDER BY played_at DESC;
```

### Check Functions:

```sql
-- Test rank calculation
SELECT calculate_rank_badge(0);    -- Should return "Intern"
SELECT calculate_rank_badge(500);  -- Should return "Junior Engineer"
SELECT calculate_rank_badge(1500); -- Should return "Mid-Level Engineer"
SELECT calculate_rank_badge(3000); -- Should return "Senior Engineer"
SELECT calculate_rank_badge(5000); -- Should return "Staff Engineer"
```

## Common Issues & Solutions

### Issue: Profile button doesn't appear

**Solution:**
- Check localStorage has `bughunt_player_id`
- Make sure you played MULTIPLAYER (not practice)
- Check browser console for errors

### Issue: Stats not updating

**Solution:**
- Check backend server logs for errors
- Verify migration was run
- Check database connection

### Issue: Match history empty

**Solution:**
- Make sure you completed the game (not left mid-game)
- Check backend logs for database errors
- Verify `player_match_history` table exists:
  ```sql
  \dt player_match_history
  ```

### Issue: Rank badge stuck at "Intern"

**Solution:**
- Check total_score is accumulating:
  ```sql
  SELECT username, total_score, rank_badge FROM players;
  ```
- Make sure function exists:
  ```sql
  SELECT calculate_rank_badge(1000);
  ```

## Quick Verification Checklist

After implementing, verify:

- ✅ Migration ran successfully
- ✅ Backend server running without errors
- ✅ Frontend loads without console errors
- ✅ Can play multiplayer and finish game
- ✅ localStorage gets populated
- ✅ Profile button appears in header
- ✅ Profile page loads with correct stats
- ✅ Match history shows recent games
- ✅ Rank badge displays correctly
- ✅ Refreshing page restores profile
- ✅ Practice mode does NOT create profile
- ✅ Title click returns to mode selection

## Performance Testing

Test with multiple concurrent players:

1. Open 4 browser tabs/windows
2. Join queue in all 4
3. Play the game together
4. Verify all 4 profiles update correctly
5. Check each player's match history

## Success Criteria

You'll know it's working when:

1. **New player flow works**: Play multiplayer → Profile created → Stats show
2. **Session persistence works**: Refresh page → Profile restored → Stats preserved
3. **Stats accumulate**: Play multiple games → Total matches/score increases
4. **Rank progression works**: Gain points → Rank badge upgrades
5. **Match history works**: Last 10 games shown → Newest first
6. **API works**: Can fetch profile by ID and restore by token
7. **Practice isolation works**: Practice mode doesn't create profiles

Good luck testing! 🎉
