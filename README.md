# Move Insole - Seed Request Tracker

Internal tool for managing seed product requests at Move Insole.

## Features

- Submit seed requests with product details (insoles, t-shirts, socks)
- Track request status (Pending → Processing → Shipped)
- Admin dashboard for managing all requests
- Shopify order ID and tracking number management
- Urgent request flagging
- Move Insole branded design

## Setup Instructions

### 1. Set up Supabase Database

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to SQL Editor and run the contents of `schema.sql`
4. Go to Project Settings → API to get:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### 2. Deploy to Render

1. Push this code to GitHub
2. Go to https://render.com and create account
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: move-seed-tracker
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add Environment Variables:
   - `SUPABASE_URL` = (your Supabase URL)
   - `SUPABASE_ANON_KEY` = (your Supabase anon key)
7. Click "Create Web Service"

### 3. Access Your App

Once deployed, Render will give you a URL like:
`https://move-seed-tracker.onrender.com`

Share this with your team!

## Development

To run locally:

```bash
npm install
npm run dev
```

Set environment variables in `.env`:
```
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
PORT=3000
```

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Supabase)
- **Hosting**: Render

## Created by

Caleb Guidry - Operations Manager @ Move Insole
