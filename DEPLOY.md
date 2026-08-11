# Deploy — put it online for a few people, with a real data store

This app is built to deploy as-is. The only things it needs in production are a
**Postgres database** (the local file store won't persist on a cloud host) and,
optionally, a **shared password** so only your people can open it.

**Recommended stack (all have free tiers, no credit card to start):**

| Piece | Use | Free option |
|---|---|---|
| **Vercel** | Hosting (it's a Next.js app) | Hobby plan |
| **Neon** (or Supabase) | Postgres database | Free tier |
| **Anthropic API key** | Live AI outputs | Pay-as-you-go |

Total time: ~15 minutes. You don't touch code — just set three environment
variables.

---

## Step 1 — Create the database (Neon)

1. Go to **https://neon.tech** → sign up (GitHub login is easiest).
2. Create a project (any name, any region near you).
3. On the project dashboard, find **Connection string** and copy it. It looks
   like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep it handy — that's your `DATABASE_URL`. (The app creates its tables
   automatically on first use; nothing to run.)

*(Supabase works too: create a project → Project Settings → Database → copy the
connection string / URI.)*

## Step 2 — Get an Anthropic API key (for live AI output)

1. Go to **https://console.anthropic.com** → **API Keys** → create one.
2. Copy it — that's your `ANTHROPIC_API_KEY`. Without it the app still runs, but
   in demo mode (seed outputs).

## Step 3 — Deploy to Vercel

1. Go to **https://vercel.com** → sign up with **GitHub**.
2. **Add New → Project** → import **ShivangiJain1897/AI-Discovery**.
3. Pick the branch **`claude/ai-discovery-payer-platform-tjx1ri`** (or `main`
   once merged).
4. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `ANTHROPIC_API_KEY` | your key from Step 2 |
   | `APP_PASSWORD` | any password you'll share with your team (optional) |

5. Click **Deploy**. In ~2 minutes you get a live URL like
   `ai-discovery-xxxx.vercel.app`.

## Step 4 — Share it

Send the URL to your team. If you set `APP_PASSWORD`, their browser will ask for
a login — username can be anything, password is the one you set.

---

## What each variable does

- **`DATABASE_URL`** — turns on the Postgres store. Intake use cases, discovery
  sessions, and prompt edits all persist here and are shared across everyone.
  Without it, the app falls back to a local file (fine for dev, lost on a host).
- **`ANTHROPIC_API_KEY`** — switches from demo seed outputs to real Claude
  output. The badge in the app shows "Live · Claude" when it's set.
- **`APP_PASSWORD`** — gates the whole app behind one shared password. Leave
  unset for an open instance.

## Updating the deployment

Every push to the branch you deployed auto-redeploys on Vercel. So the normal
flow — make a change, `git push` — updates the live site in a couple of minutes.

## Cost notes

- Vercel Hobby + Neon free tier: **$0** for a small pilot.
- Anthropic: **pay per token**. A few users doing discovery runs is typically a
  few dollars; set a usage limit in the Anthropic console to be safe.

## When you outgrow the pilot (later)

- **Auth**: replace the shared password with real accounts/SSO (e.g. Auth.js) so
  you know who did what. The password gate lives in `middleware.ts`.
- **Per-user attribution**: the intake tracker already stamps a name; wire it to
  real identities.
- **Backups & migrations**: Neon/Supabase handle backups; add schema migrations
  if the data model grows (today tables are simple JSONB and self-create).
