# Stripe Payment Testing Guide

## 🎯 Overview

BugHunt Live now has **real Stripe integration** for testing the payment flow before going live. You can test with:
- **Real Stripe (Test Mode)**: Use Stripe's test cards to simulate real payments
- **Mock Payment**: Skip payment entirely for quick testing

---

## 📋 Setup Instructions

### Step 1: Get Stripe Test API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/register) and create an account (or log in)
2. Make sure you're in **Test Mode** (toggle in top right should say "Test mode")
3. Go to [Developers → API Keys](https://dashboard.stripe.com/test/apikeys)
4. Copy your keys:
   - **Publishable key** starts with `pk_test_...`
   - **Secret key** starts with `sk_test_...`

### Step 2: Add Keys to Environment Files

#### Backend Keys (`.env` in root):
```bash
# Edit /Users/michaelmartinez/bughunt-live/.env

STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

#### Frontend Keys (`client/.env`):
```bash
# Edit /Users/michaelmartinez/bughunt-live/client/.env

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
```

⚠️ **Important**: Never commit real secret keys to git! The `.env` files are already gitignored.

### Step 3: Restart Servers

```bash
# Stop backend
lsof -ti:3000 | xargs kill -9

# Start backend
cd /Users/michaelmartinez/bughunt-live
NODE_ENV=development node src/server.js

# Frontend should auto-reload when you change client/.env
# If not, restart it:
cd client
npm run dev
```

---

## 🧪 Testing the Payment Flow

### Option 1: Test with Real Stripe (Recommended)

This simulates a real payment using Stripe's test mode.

#### Test Cards (from [Stripe Docs](https://stripe.com/docs/testing)):

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | ✅ Successful payment |
| `4000 0000 0000 9995` | ❌ Declined (insufficient funds) |
| `4000 0000 0000 9987` | ❌ Declined (lost card) |
| `4000 0025 0000 3155` | ✅ Requires authentication (3D Secure) |

**Expiry**: Any future date (e.g., `12/34`)
**CVC**: Any 3 digits (e.g., `123`)
**ZIP**: Any 5 digits (e.g., `12345`)

#### Steps:

1. **Clear localStorage** (to start as a new user):
   ```javascript
   // In browser console:
   localStorage.clear();
   ```

2. **Reload page** → Navigate to app

3. **Select "Multiplayer"** mode

4. **Enter username** → Click "Join Matchmaking"

5. **Payment gate appears** with two buttons:
   - **"Pay with Card"** ← Click this one
   - "Mock Payment (Testing)"

6. **Stripe Checkout Form appears**:
   - Card number: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Name: Your name
   - Country: United States
   - ZIP: `12345`

7. **Click "Pay $19.00"**

8. **Wait** for payment processing (~2 seconds)

9. **Success!** You should see:
   - Alert: "Payment successful! You now have access to multiplayer profiles."
   - Redirected back to username screen
   - Can now join matchmaking

10. **Verify in Stripe Dashboard**:
    - Go to [Stripe Dashboard → Payments](https://dashboard.stripe.com/test/payments)
    - You should see your $19.00 test payment
    - Status: "Succeeded"
    - Metadata includes your `playerId`

#### Testing Failed Payments:

Use the **declined card**: `4000 0000 0000 9995`

Expected behavior:
- Payment fails
- Error message shown
- User remains at payment gate
- Can try again with a different card

#### Testing 3D Secure:

Use the **3D Secure card**: `4000 0025 0000 3155`

Expected behavior:
- Modal pops up asking to "Complete"
- Click "Complete" button
- Payment succeeds

---

### Option 2: Mock Payment (Quick Testing)

Skip Stripe entirely for rapid testing.

#### Steps:

1. Clear localStorage and reload

2. Select "Multiplayer" mode

3. Enter username → Click "Join Matchmaking"

4. **Click "Mock Payment (Testing)"** button

5. Wait 1.5 seconds (simulated processing)

6. Success! Profile unlocked

**When to use**:
- Testing game mechanics (not payment)
- Quick iteration during development
- Demo without real payment UI

---

## 🔍 Verifying Payment Worked

### 1. Check localStorage

```javascript
// In browser console:
localStorage.getItem('bughunt_profile_token')
// Should return: a 64-character hex string

localStorage.getItem('bughunt_player_id')
// Should return: a UUID
```

### 2. Check Database

```sql
-- Connect to PostgreSQL
psql -U postgres -d bughunt_live

-- Check the player record
SELECT
  id,
  username,
  has_paid,
  payment_date,
  stripe_payment_id,
  profile_token
FROM players
WHERE has_paid = true
ORDER BY payment_date DESC
LIMIT 5;
```

Expected output:
```
has_paid | payment_date        | stripe_payment_id
---------|---------------------|------------------
true     | 2026-01-05 22:15:32 | pi_3abc123xyz...
```

### 3. Check Backend Logs

```bash
tail -f /tmp/bughunt-server.log
```

Look for:
```
[Connection] Player connected: <socket_id>
Payment intent created: pi_3abc123xyz...
Player upgraded to paid status: <player_id>
```

### 4. Check Stripe Dashboard

Go to [Stripe Dashboard → Payments](https://dashboard.stripe.com/test/payments)

You should see:
- **Amount**: $19.00
- **Status**: Succeeded
- **Created**: Just now
- **Metadata**:
  - `playerId`: Your UUID

---

## 🎮 Testing Full User Journey

### Test 1: New Free User → Paid User

1. **Start fresh**: `localStorage.clear()`

2. **Try Practice Mode**:
   - Should work without payment
   - No profile button in header

3. **Try Multiplayer**:
   - Hit payment gate
   - Cannot proceed

4. **Make payment**:
   - Click "Pay with Card"
   - Use test card: `4242 4242 4242 4242`
   - Complete payment

5. **Verify access**:
   - Now can join matchmaking
   - Profile button appears in header

6. **Play a game**:
   - Complete multiplayer match
   - Stats saved to profile

7. **Refresh page**:
   - Profile automatically restored
   - Can immediately join multiplayer (no payment gate)

### Test 2: Session Persistence

1. **After completing Test 1**, close browser completely

2. **Reopen browser** → Navigate to app

3. **Verify**:
   - Profile automatically loaded
   - Username remembered
   - No payment gate when selecting multiplayer
   - Stats preserved from previous session

### Test 3: Multiple Browsers/Devices

1. **Get profile token**:
   ```javascript
   localStorage.getItem('bughunt_profile_token')
   // Copy this value
   ```

2. **Open different browser/device**

3. **Set profile token manually**:
   ```javascript
   localStorage.setItem('bughunt_profile_token', 'PASTE_TOKEN_HERE')
   localStorage.setItem('bughunt_player_id', 'PASTE_PLAYER_ID_HERE')
   localStorage.setItem('bughunt_username', 'YourUsername')
   ```

4. **Reload page**:
   - Profile restored
   - Can access multiplayer
   - Same stats

---

## 🐛 Troubleshooting

### Error: "Failed to initialize payment"

**Cause**: Stripe keys not configured

**Fix**:
1. Check `.env` has `STRIPE_SECRET_KEY=sk_test_...`
2. Check `client/.env` has `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
3. Restart both servers

### Error: "Payment not completed. Status: requires_payment_method"

**Cause**: Payment was attempted but failed

**Fix**:
- Use a valid test card: `4242 4242 4242 4242`
- Check all fields are filled correctly
- Try refreshing the page and starting over

### Payment succeeds but profile not created

**Cause**: Backend upgrade endpoint failed

**Check**:
1. Backend logs: `tail -f /tmp/bughunt-server.log`
2. Database connection working: `psql -U postgres -d bughunt_live -c "SELECT 1"`
3. Player exists: `SELECT * FROM players WHERE id = 'your-player-id'`

### Stripe Dashboard shows no payments

**Cause**: Using wrong keys or production mode

**Fix**:
1. Make sure you're in **Test Mode** (toggle in Stripe dashboard)
2. Using `pk_test_...` and `sk_test_...` keys (not `pk_live_...`)
3. Check browser console for errors

### "Module not found: stripe"

**Cause**: Stripe package not installed

**Fix**:
```bash
npm install stripe
npm install --prefix client @stripe/stripe-js @stripe/react-stripe-js
```

---

## 📊 Monitoring Test Payments

### Stripe Dashboard Features

1. **[Payments](https://dashboard.stripe.com/test/payments)**:
   - See all test transactions
   - Filter by status, amount, date
   - View customer details

2. **[Logs](https://dashboard.stripe.com/test/logs)**:
   - All API requests
   - Webhooks (for future implementation)
   - Errors and warnings

3. **[Events](https://dashboard.stripe.com/test/events)**:
   - Payment intent created
   - Payment succeeded/failed
   - Charge updated

### Backend Monitoring

```bash
# Watch logs in real-time
tail -f /tmp/bughunt-server.log

# Search for payment events
grep "payment" /tmp/bughunt-server.log

# Search for errors
grep "Error" /tmp/bughunt-server.log
```

---

## 🚀 Going Live (When Ready)

### Switch to Live Mode

1. **Get Live API Keys**:
   - In Stripe Dashboard, toggle to **Live Mode**
   - Go to [API Keys](https://dashboard.stripe.com/apikeys)
   - Copy `pk_live_...` and `sk_live_...`

2. **Update .env files**:
   ```bash
   # Backend
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
   STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY

   # Frontend
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
   ```

3. **Activate Stripe Account**:
   - Complete business details
   - Add bank account for payouts
   - Verify identity

4. **Test with Real Card**:
   - Use your own credit card
   - Make a real $19 payment
   - Refund yourself: [Stripe Dashboard → Payments → Select payment → Refund](https://dashboard.stripe.com/payments)

5. **Remove Mock Payment Button**:
   - Edit `Lobby.jsx`
   - Remove the "Mock Payment (Testing)" button
   - Only show "Pay with Card"

---

## 💡 Tips for Testing

### Best Practices

✅ **Always test in Test Mode first**
- Never use live keys during development
- Test mode is completely free

✅ **Test failure scenarios**
- Declined cards
- Network errors
- Database failures

✅ **Clear localStorage between tests**
- Simulates new users
- Prevents state pollution

✅ **Check all three places**:
1. Browser localStorage
2. Database
3. Stripe Dashboard

### Test Checklist

Before going live, verify:

- [ ] Successful payment with `4242 4242 4242 4242`
- [ ] Declined payment with `4000 0000 0000 9995`
- [ ] 3D Secure flow with `4000 0025 0000 3155`
- [ ] Profile persists after page refresh
- [ ] Stats tracked correctly after payment
- [ ] Free users blocked from multiplayer
- [ ] Paid users can access multiplayer immediately
- [ ] Mock payment button works (for dev testing)
- [ ] Database records payment correctly
- [ ] Stripe Dashboard shows payment

---

## 📚 Resources

- **Stripe Docs**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing
- **Payment Intents**: https://stripe.com/docs/payments/payment-intents
- **Stripe React**: https://stripe.com/docs/stripe-js/react
- **Webhooks** (future): https://stripe.com/docs/webhooks

---

## 🔐 Security Notes

### Current Implementation

✅ **Secure**:
- Payment verification on backend
- Profile tokens are 256-bit random
- Stripe handles all card data (PCI compliant)
- Payment intent verified before upgrade
- Player ID matched to payment metadata

⚠️ **Limitations** (MVP):
- No webhook validation yet
- No refund handling
- No subscription support
- localStorage only (can be cleared)

### Production Recommendations

1. **Add Webhook Handlers**:
   ```javascript
   // Handle payment_intent.succeeded
   // Handle payment_intent.payment_failed
   // Handle charge.refunded
   ```

2. **Add Email Receipts**:
   - Collect email at payment
   - Send confirmation email
   - Enable profile recovery

3. **Add Refund Flow**:
   - Support desk can refund
   - Automatically revoke profile access
   - Log refund reasons

4. **Add Fraud Detection**:
   - Stripe Radar (automatic)
   - Rate limiting on payment attempts
   - Monitor for suspicious patterns

---

## 🎉 Summary

You now have:

✅ Full Stripe integration in test mode
✅ Real payment flow with test cards
✅ Mock payment for quick testing
✅ Payment verification on backend
✅ Profile upgrade after successful payment
✅ Database tracking of payments
✅ Session persistence across reloads

**Ready to test!** Start with Option 1 above (Real Stripe test cards) to simulate the full payment experience.

Questions? Check the troubleshooting section or Stripe docs linked above.
