# Stanley Pool 2026 — Deploy Guide

Complete setup takes about 20–30 minutes. Follow each step in order.

---

## Step 1 — Set up the database (Supabase)

1. Go to **supabase.com** and open your project (or create a new one — free tier is fine)
2. In the left sidebar click **SQL Editor**
3. Click **New query**
4. Open the file `supabase/migrations/001_init.sql` from this folder
5. Copy the entire contents and paste it into the SQL Editor
6. Click **Run** (green button) — you should see "Success"

**Get your API keys:**
1. In Supabase left sidebar go to **Project Settings → API**
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon public** key (long string starting with `eyJ...`)

**Enable email magic links:**
1. In Supabase go to **Authentication → Providers**
2. Make sure **Email** is enabled
3. Go to **Authentication → Email Templates** — you can customize the sign-in email here

---

## Step 2 — Set up the code (GitHub)

1. Create a new repository on **github.com** (name it `stanley-pool`, can be private)
2. Upload all files from this folder to that repository
   - Easiest way: drag and drop the entire folder into the GitHub web UI
   - Or use GitHub Desktop app if you have it

---

## Step 3 — Add your environment variables

In your GitHub repo, create a file called `.env.local` with these values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
VITE_ADMIN_EMAIL=your@email.com
```

Replace each value with your actual Supabase URL, anon key, and your email address.

> ⚠️ Do NOT commit `.env.local` — it's already in `.gitignore` to keep your keys safe.

---

## Step 4 — Deploy to Vercel

1. Go to **vercel.com** and sign in
2. Click **Add New → Project**
3. Click **Import** next to your `stanley-pool` GitHub repo
4. Under **Environment Variables**, add these three:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `VITE_ADMIN_EMAIL` | your email address |

5. Click **Deploy** — Vercel builds and deploys automatically (takes ~1 minute)
6. Your app is live at `https://stanley-pool.vercel.app` (or similar)

---

## Step 5 — Connect Supabase to your Vercel URL

1. In Supabase go to **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://stanley-pool.vercel.app`)
3. Under **Redirect URLs** add: `https://stanley-pool.vercel.app/**`
4. Click Save

---

## Step 6 — Test it

1. Open your Vercel URL in a browser
2. Enter your email and click "Send Sign-In Link"
3. Check your email — click the link
4. You should land on the Home page — you're in!

---

## How to invite your friends

Just share the URL with them. When they visit, they enter their email and get a magic link. That's it — no passwords, no sign-up form.

You'll be able to see all members in the **Admin panel** (only visible to your email address).

---

## Running the pool — your admin workflow

### Before the playoffs start (before Sunday noon PT):
- Share the URL with all pool members
- Tell them to sign in and submit their picks before the deadline

### After each series ends:
1. Go to **Admin → Enter Results**
2. Select the winner and number of games for that series
3. Click **1. Save Results**
4. Click **2. Recalculate Scores**
5. The leaderboard updates instantly for everyone

### Unlocking later rounds:
- Round 2 unlocks automatically once all Round 1 results are entered
- Same for Conference Finals and the Stanley Cup Final

---

## Running it locally (optional)

If you want to run it on your own computer first:

```bash
# Install Node.js from nodejs.org first if you haven't

# In the stanley-pool folder:
npm install
cp .env.example .env.local
# Edit .env.local with your real keys

npm run dev
# Open http://localhost:3000
```

---

## Troubleshooting

**"Invalid login" or email not arriving:**
- Check your Supabase Authentication → URL Configuration has the right site URL
- Check spam folder
- Make sure the email address is correct

**Leaderboard shows no scores:**
- Scores only appear after you enter results AND click "Recalculate Scores" in Admin

**App shows blank page:**
- Check Vercel deployment logs for errors
- Make sure all 3 environment variables are set correctly in Vercel

**Can't access Admin page:**
- Make sure `VITE_ADMIN_EMAIL` in Vercel exactly matches the email you signed in with (case-sensitive)

---

## File structure

```
stanley-pool/
├── src/
│   ├── components/
│   │   ├── TopBar.jsx       # Header with logo + deadline
│   │   └── NavBar.jsx       # Navigation tabs
│   ├── hooks/
│   │   └── useAuth.jsx      # Login state management
│   ├── lib/
│   │   ├── supabase.js      # DB client + playoff data
│   │   ├── nhl.js           # NHL + ESPN API calls
│   │   └── scoring.js       # Points calculation engine
│   ├── pages/
│   │   ├── LoginPage.jsx    # Email magic link login
│   │   ├── HomePage.jsx     # Dashboard + news feed
│   │   ├── PicksPage.jsx    # All 4 rounds of picks
│   │   ├── LeaderboardPage.jsx
│   │   ├── ScoringPage.jsx
│   │   └── AdminPage.jsx    # Admin only
│   ├── App.jsx              # Routing
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── supabase/
│   └── migrations/
│       └── 001_init.sql     # Run this in Supabase SQL Editor
├── index.html
├── vite.config.js
├── package.json
├── .env.example             # Copy to .env.local and fill in
└── .gitignore
```

---

## Email notifications setup (optional but recommended)

Email notifications are sent when you enter a series result in Admin. They use a free service called **Resend**.

1. Sign up free at **resend.com**
2. Get your API key from the Resend dashboard
3. In Supabase go to **Edge Functions → Secrets** and add:
   - `RESEND_API_KEY` = your Resend API key
   - `APP_URL` = your Vercel URL (e.g. `https://bahdsplayoffpool.vercel.app`)
4. Deploy the edge function from your project folder:
   ```
   npx supabase functions deploy notify-series-result
   ```
   (You'll need to install Supabase CLI: `npm install -g supabase`)

After that, every time you save a new series result in the Admin panel, every pool member gets an email with the result and the current top-5 leaderboard.

> If you skip this step, the app still works perfectly — notifications are just a bonus.

---

## New features in this version

- **Clickable picks viewer** — after the deadline, click any name on the leaderboard to see their full bracket with correct/incorrect highlights
- **vs The Field** — leaderboard shows what % of the pool picked each team and series length
- **Series in progress** — home page shows live game scores and series status from the NHL API
- **Commissioner note** — you (admin) can post a message visible to everyone on the home page. Great for trash talk.
- **Email notifications** — pool members get emailed when a series ends (requires Resend setup above)

---

## Switching to email/password login

The app now uses email + password instead of magic links. One quick change needed in Supabase:

1. Go to **Authentication → Sign In / Providers → Email**
2. Make sure **Enable Email provider** is ON
3. Turn OFF **Confirm email** (optional — makes signup instant without needing to verify)
4. Hit Save

The login page now has:
- Sign in with email + password
- Create account (for new members)
- Forgot password → sends reset link to their email
- Reset password page (auto-detected from the reset link)

## Adding your app icon

1. Put your icon images in the `public/` folder named `icon-192.png` and `icon-512.png`
2. They should be square PNG images (192x192 and 512x512 pixels)
3. Redeploy and the home screen icon will update

## Installing as a home screen app

**iPhone:** Open bahdsplayoff.com in Safari → Share button → Add to Home Screen → Add

**Android:** Open in Chrome → three dots menu → Add to Home Screen
