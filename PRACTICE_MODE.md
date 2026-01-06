# Practice Mode - Implementation Summary

## Overview

Practice Mode is a **single-player** version of BugHunt Live that allows users to play solo without waiting for other players. It uses the same bug questions and scoring system but operates entirely client-side with no Socket.io connection.

## Key Differences: Practice vs Multiplayer

| Feature | Practice Mode | Multiplayer Mode |
|---------|--------------|------------------|
| **Players** | Solo (1 player) | 2-4 players |
| **Communication** | REST API | Socket.io |
| **Matchmaking** | None | Queue-based |
| **Leaderboard** | No persistence | Saved to database |
| **State Management** | Local (React state) | Server-managed |
| **Timer** | Client-side | Server-controlled |
| **Score** | Client-calculated | Server-validated |

## Backend Implementation

### API Endpoints

#### 1. GET `/api/practice/questions`

Fetches random questions for practice mode.

**Query Parameters:**
- `count` (optional, default: 5) - Number of questions

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "id": "q1",
      "code": "function example() { ... }",
      "question": "What's the bug?",
      "choices": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" },
        { "id": "c", "text": "Option C" },
        { "id": "d", "text": "Option D" }
      ]
    }
  ],
  "timeLimit": 30
}
```

**Note:** Correct answers are NOT included in the response.

#### 2. POST `/api/practice/check-answer`

Validates an answer and returns feedback.

**Request Body:**
```json
{
  "questionId": "q1",
  "answerId": "a"
}
```

**Response:**
```json
{
  "success": true,
  "correct": true,
  "correctAnswer": "a",
  "explanation": "...",
  "points": 100
}
```

### Backend Files Modified

1. **[src/server.js](src/server.js:127-192)** - Added 2 new API endpoints
   - Lines 127-192: Practice Mode API endpoints

### No Database Writes

Practice mode intentionally does NOT save results to the database. This keeps it lightweight and separate from competitive multiplayer.

## Frontend Implementation

### New Components

#### 1. **PracticeGame.jsx**

**Purpose:** Handles the entire practice game flow locally.

**Key Features:**
- Fetches questions from API on mount
- Manages timer countdown (client-side)
- Handles answer selection and submission
- Calculates score locally
- Auto-advances through questions
- Calls `onGameEnd` when complete

**State Management:**
```javascript
- questions[] - All questions for this game
- currentQuestionIndex - Which question is active
- timeRemaining - Countdown timer
- selectedAnswer - User's choice
- answerSubmitted - Whether answer was submitted
- answerFeedback - Correct/incorrect feedback
- score - Total score
- correctAnswers - Number correct
```

**Location:** [client/src/components/PracticeGame.jsx](client/src/components/PracticeGame.jsx)

### Modified Components

#### 1. **App.jsx**

**Changes:**
- Added `gameMode` state ('practice' or 'multiplayer')
- Added `'mode-select'` and `'practice-playing'` game states
- Added `handleModeSelect()` - Handles mode selection
- Added `handlePracticeGameEnd()` - Processes practice results
- Updated `resetToLobby()` - Resets to mode selection screen
- Imported PracticeGame component
- Added conditional rendering for practice game

**Location:** [client/src/App.jsx](client/src/App.jsx)

#### 2. **Lobby.jsx**

**Changes:**
- Added mode selection screen (Practice vs Multiplayer cards)
- Added `onModeSelect` prop handler
- Added `gameMode` prop
- Updated `handleJoinQueue()` - Routes to practice or multiplayer based on mode
- Added UI for mode selection with feature lists

**Location:** [client/src/components/Lobby.jsx](client/src/components/Lobby.jsx)

#### 3. **GameOver.jsx**

**Changes:**
- Added `isPractice` prop
- Conditional title ("Practice Complete!" vs "Game Over!")
- Conditional trophy icon (🎯 vs 🏆)
- Added practice badge
- Added upgrade prompt encouraging multiplayer
- Conditional button text ("Back to Menu" vs "Play Again")

**Location:** [client/src/components/GameOver.jsx](client/src/components/GameOver.jsx)

### CSS Additions

**New Styles:**
- `.mode-selection` - Grid layout for mode cards
- `.mode-card` - Individual mode selection button
- `.mode-icon`, `.mode-description`, `.mode-features` - Mode card styling
- `.practice-badge` - Green badge for practice mode
- `.practice-stats` - Score display in practice sidebar
- `.stat-row`, `.stat-label`, `.stat-value` - Practice stats styling
- `.upgrade-prompt` - Multiplayer promotion message

**Location:** [client/src/styles/App.css](client/src/styles/App.css)

## User Flow

### Practice Mode Flow

```
1. App starts → Mode Selection Screen
   ↓
2. User clicks "Practice Mode"
   ↓
3. Enter Username
   ↓
4. Click "Join Matchmaking"
   ↓
5. Practice Game Loads
   - Fetches 5 random questions from API
   - Displays first question
   ↓
6. For Each Question:
   - User selects answer
   - Clicks "Submit Answer"
   - API checks answer
   - Shows feedback (correct/incorrect + explanation)
   - Waits 3 seconds
   - Moves to next question
   ↓
7. After All Questions:
   - Calls onGameEnd()
   - Shows Game Over screen
   - Displays final score
   - Shows upgrade prompt
   ↓
8. Click "Back to Menu"
   - Returns to mode selection
```

### Multiplayer Mode Flow

```
1. App starts → Mode Selection Screen
   ↓
2. User clicks "Multiplayer"
   ↓
3. Enter Username
   ↓
4. Click "Join Matchmaking"
   ↓
5. Socket.io connects
   ↓
6. Waits in queue for 2-4 players
   ↓
7. Match starts (server-controlled)
   ↓
8. Game ends (saved to database)
   ↓
9. Click "Play Again" → Returns to mode selection
```

## Technical Implementation Details

### Why No Socket.io for Practice?

**Benefits:**
- Faster game start (no matchmaking wait)
- Simpler code (no real-time sync needed)
- Lower server load (just HTTP)
- Better for learning (pause, retry, etc.)
- Offline-capable (future enhancement)

### Client-Side vs Server-Side

| Aspect | Practice | Multiplayer |
|--------|----------|-------------|
| **Question Fetching** | HTTP GET (all at once) | Socket.io (one at a time) |
| **Timer** | Client countdown | Server countdown |
| **Answer Validation** | HTTP POST | Socket.io emit |
| **Score Calculation** | Client adds points | Server tracks score |
| **Game End** | Local callback | Socket.io event |

### Security Considerations

**Practice Mode:**
- Questions sent without correct answers
- Answers validated server-side (can't cheat by inspecting)
- Score NOT saved to database (prevents fake leaderboard entries)

**Multiplayer Mode:**
- Full server validation
- Scores saved to database
- Leaderboard persistence

## Testing

### Manual Testing Checklist

**Practice Mode:**
- [ ] Mode selection screen displays
- [ ] Practice mode card is clickable
- [ ] Username entry works
- [ ] Questions load from API
- [ ] Timer counts down correctly
- [ ] Can select and submit answers
- [ ] Answer feedback appears
- [ ] Moves to next question after delay
- [ ] Score increments correctly
- [ ] Game over screen shows after 5 questions
- [ ] Practice badge displays
- [ ] Upgrade prompt shows
- [ ] "Back to Menu" returns to mode selection

**Multiplayer Mode:**
- [ ] Multiplayer card is clickable
- [ ] Socket.io connects
- [ ] Queue system works
- [ ] Match starts with 2+ players
- [ ] Real-time gameplay works
- [ ] Scores save to database
- [ ] "Play Again" returns to mode selection

### API Testing

```bash
# Test questions endpoint
curl http://localhost:3000/api/practice/questions?count=5

# Test answer checking
curl -X POST http://localhost:3000/api/practice/check-answer \
  -H "Content-Type: application/json" \
  -d '{"questionId":"q1","answerId":"a"}'
```

## File Structure

```
Backend:
src/
├── server.js (modified - lines 127-192)
└── services/
    └── QuestionService.js (reused - no changes)

Frontend:
client/src/
├── App.jsx (modified - added practice mode logic)
├── components/
│   ├── Lobby.jsx (modified - added mode selection)
│   ├── PracticeGame.jsx (NEW - practice game component)
│   └── GameOver.jsx (modified - practice mode support)
└── styles/
    └── App.css (modified - added practice styles)
```

## Future Enhancements

Potential improvements:
- Difficulty levels (Easy, Medium, Hard)
- Question categories (Arrays, Functions, Async, etc.)
- Practice stats tracking (localStorage)
- Review wrong answers
- Timed challenges
- Daily practice streak
- Offline mode support
- Mobile app version

## Summary

Practice Mode provides a **lightweight, single-player** alternative to multiplayer matches. It reuses the same question pool and UI components but operates independently without Socket.io, matchmaking, or database persistence.

**Lines of Code:**
- Backend: ~65 lines (2 endpoints)
- Frontend: ~280 lines (PracticeGame component)
- Modified: ~50 lines across existing components
- **Total: ~395 lines of new code**

The implementation is **minimal, MVP-level, and non-invasive** to the existing multiplayer system.
