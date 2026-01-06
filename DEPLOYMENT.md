# BugHunt Live - Deployment Guide

This guide covers deploying BugHunt Live to production with:
- **Railway**: Backend server (WebSockets + API + Payments)
- **Vercel**: Frontend (React app)
- **Railway PostgreSQL**: Database
- **Stripe**: Payment processing

---

## Architecture

```
Frontend (Vercel) → Backend (Railway) → Database (Railway PostgreSQL)
                          ↓
                      Stripe Webhooks
```

---

## 1. Deploy Backend to Railway

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"

### Step 2: Deploy from GitHub
1. Select "Deploy from GitHub repo"
2. Choose `Martimic10/bug-hunt-live`
3. Railway will auto-detect the Node.js app

### Step 3: Add PostgreSQL Database
1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will create a database and provide a connection string

### Step 4: Configure Environment Variables
In Railway dashboard, add these variables:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLIENT_URL=<your-vercel-frontend-url>
STRIPE_SECRET_KEY=<your-stripe-live-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-live-publishable-key>
```

**Note**: `DATABASE_URL` will automatically reference your Railway PostgreSQL database.

### Step 5: Run Database Migrations
1. In Railway dashboard, go to your PostgreSQL database
2. Click "Connect" → "psql"
3. Run the schema:
   ```sql
   -- Copy and paste the contents of database/schema.sql
   ```

### Step 6: Get Your Backend URL
- Railway will provide a public URL like: `https://your-app.railway.app`
- Save this URL for the frontend configuration

---

## 2. Deploy Frontend to Vercel

### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub

### Step 2: Import Project
1. Click "Add New..." → "Project"
2. Import `Martimic10/bug-hunt-live`

### Step 3: Configure Build Settings
Vercel should auto-detect these settings:
- **Build Command**: `cd client && npm install && npm run build`
- **Output Directory**: `client/dist`
- **Install Command**: `cd client && npm install`

### Step 4: Add Environment Variables
In Vercel dashboard, add:

```
VITE_API_URL=<your-railway-backend-url>
VITE_STRIPE_PUBLISHABLE_KEY=<your-stripe-live-publishable-key>
```

### Step 5: Deploy
- Click "Deploy"
- Vercel will build and deploy your frontend
- You'll get a URL like: `https://your-app.vercel.app`

---

## 3. Update Frontend to Use Production Backend

You need to update the Socket.io and API URLs in your frontend code.

### Update `client/src/utils/socket.js`:
```javascript
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const socket = io(SOCKET_URL);
```

### Update API calls in components:
Replace `http://localhost:3000` with:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

---

## 4. Configure Stripe Webhooks

### Step 1: Switch to Live Mode
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle from "Test mode" to "Live mode"
3. Get your live API keys

### Step 2: Create Webhook Endpoint
1. In Stripe Dashboard, go to "Developers" → "Webhooks"
2. Click "Add endpoint"
3. Enter your Railway backend URL + `/webhook`:
   ```
   https://your-app.railway.app/webhook
   ```
4. Select event: `checkout.session.completed`
5. Click "Add endpoint"

### Step 3: Get Webhook Signing Secret
- Stripe will show you a webhook signing secret (starts with `whsec_`)
- Add this to your Railway environment variables:
  ```
  STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
  ```

---

## 5. Update Backend CORS

Make sure your backend allows requests from your Vercel frontend.

In `src/server.js`, update the CORS middleware:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-app.vercel.app'  // Add your Vercel URL
];
```

---

## 6. Final Steps

### Push Code Changes
```bash
git add .
git commit -m "Configure for production deployment"
git push
```

### Redeploy
- Railway will auto-deploy when you push to main
- Vercel will also auto-deploy on push

### Test Production
1. Visit your Vercel URL
2. Try practice mode (should work immediately)
3. Try multiplayer mode:
   - Enter username
   - Click "Pay with Card"
   - Use Stripe test card: `4242 4242 4242 4242`
   - Verify payment completes and you can join queue

---

## Environment Variables Summary

### Railway (Backend)
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLIENT_URL=https://your-app.vercel.app
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Vercel (Frontend)
```env
VITE_API_URL=https://your-app.railway.app
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
```

---

## Monitoring

### Railway Logs
- View logs in Railway dashboard
- Monitor server health at: `https://your-app.railway.app/health`

### Vercel Logs
- View deployment and runtime logs in Vercel dashboard

### Stripe Events
- Monitor webhook deliveries in Stripe Dashboard → Developers → Webhooks

---

## Troubleshooting

### WebSocket Connection Issues
- Check that Railway URL is correctly set in frontend
- Verify CORS allows your Vercel domain
- Check Railway logs for connection errors

### Payment Not Working
- Verify Stripe webhook is receiving events
- Check webhook signing secret is correct
- Review Railway logs for webhook errors

### Database Connection Issues
- Verify DATABASE_URL is set correctly in Railway
- Check PostgreSQL is running in Railway dashboard
- Ensure migrations were run successfully

---

## Cost Estimates

- **Railway**: ~$5/month (Hobby plan) + Database (~$5/month)
- **Vercel**: Free (Hobby tier for personal projects)
- **Stripe**: 2.9% + 30¢ per transaction

**Total**: ~$10/month + Stripe fees

---

## Support

For issues, create a GitHub issue at: https://github.com/Martimic10/bug-hunt-live/issues
