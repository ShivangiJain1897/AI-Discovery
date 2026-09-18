# Start here

This is a guide for getting the platform running on your own computer.
It assumes you have never used a terminal. You do not need to write any code.

**Time needed:** about 20 minutes, most of it waiting for downloads.
**You do this once.** After that, opening the app is a double-click.

---

## Honest expectation-setting

This is a real application with three parts: a web interface, a research
engine, and a database. That means there is some installing to do.

There are three ways to get it, and it is worth picking deliberately:

| | Effort for you | Best when |
|---|---|---|
| **A. Ask an engineer** | Send them one link | Someone technical is around. ~30 min for them. |
| **B. Do it yourself with the installer** | Follow this guide | You want it today and nobody is free. |
| **C. Have it hosted** | Someone sets it up once, you get a web link | More than one person will use it. |

If you have an engineer on your team, **option A is genuinely the best use of
everyone's time** — send them `SETUP.md` and this will be done before lunch.

If not, option B works. Keep reading.

---

## What you are installing, in plain terms

Four things. All free, all from official sites.

| Thing | What it does here |
|---|---|
| **Docker Desktop** | Runs the database that stores your research |
| **Python** | Runs the research engine |
| **Node** | Runs the screens you look at |
| **The app itself** | Everything this project built |

You will also need **one paid API key** from Anthropic. That is what actually
does the research and analysis. Expect a few dollars a month for normal use.

---

## Part 1 — Install the four things

Do these in order. Accept every default. Restart nothing unless asked.

### 1. Docker Desktop

Go to **[docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)**
and click the download button for your computer (Mac or Windows).

Install it, then **open the Docker Desktop app**. You will see a whale icon
appear in your menu bar (Mac) or system tray (Windows).

> **Important:** Docker has to be *open and running*, not just installed.
> The whale icon needs to have stopped animating. This takes about 30 seconds
> the first time.

### 2. Python

Go to **[python.org/downloads](https://www.python.org/downloads/)** and click
the big yellow download button. Install it.

> **On Windows:** on the very first screen of the installer, tick the box that
> says **"Add python.exe to PATH"** before clicking Install. It is easy to miss
> and things will not work without it.

### 3. Node

Go to **[nodejs.org](https://nodejs.org/)** and download the version labelled
**LTS**. Install it.

### 4. The app

Go to the project page:
**[github.com/ShivangiJain1897/AI-Discovery](https://github.com/ShivangiJain1897/AI-Discovery/tree/claude/youthful-cannon-njtlw3)**

Click the green **Code** button → **Download ZIP**.

Find the downloaded file, double-click to unzip it, and **move the resulting
folder somewhere you will find again** — your Documents folder is fine.

---

## Part 2 — Get your AI key

1. Go to **[console.anthropic.com](https://console.anthropic.com)**
2. Sign in, or create an account
3. Add a payment method under **Billing** — the research will not run without
   one. A small amount of credit is plenty to start.
4. Click **API Keys** in the left sidebar
5. Click **Create Key**, give it any name, then **copy it**

It looks like `sk-ant-api03-xxxxxxxx...` and is very long. Keep it on your
clipboard, or paste it somewhere safe for a minute — you will need it shortly.

> **Treat this like a password.** Anyone with it can spend money on your
> account. Do not email it or paste it into a chat.

### Optional but recommended: a web search key

Without this, the platform cannot read the actual web — research returns
labelled placeholders instead of real sources.

Go to **[tavily.com](https://tavily.com)**, sign up (the free tier is about
1,000 searches a month, which is plenty), and copy the key from your
dashboard. It starts with `tvly-`.

---

## Part 3 — Run the installer

Open the app folder you unzipped.

### On a Mac

Double-click **`setup.command`**.

> **If Mac says it cannot be opened because it is from an unidentified
> developer:** right-click the file instead, choose **Open**, then click
> **Open** again in the dialog. You only need to do this once.

### On Windows

Double-click **`setup.bat`**.

> **If Windows shows a blue "Windows protected your PC" box:** click
> **More info**, then **Run anyway**.

### What happens next

A black window opens and walks you through six steps. It will:

- Check the four things are installed — and if something is missing, tell you
  exactly what and give you the link
- **Ask you to paste your AI key.** Paste it and press Enter.
  (On Mac, `Cmd+V`. On Windows, right-click inside the window to paste.)
- Ask for the search key — paste it, or just press Enter to skip
- Install everything and set up the database

The installing part takes about three minutes and looks like it is doing
nothing. Leave it alone.

When it finishes it says **"Setup is complete"** and offers to start the app.
Say yes.

---

## Part 4 — Using it

From now on, to open the platform:

- **Mac:** double-click **`start.command`**
- **Windows:** double-click **`start.bat`**

It opens your browser at **http://localhost:3000** after about 20 seconds.

**Leave the black window open while you use the app.** It is the app. Closing
it stops everything.

To stop: close that window.

> Docker Desktop also needs to be running. If you restart your computer, open
> Docker Desktop first, then `start`.

---

## Part 5 — Check your key actually worked

This matters, because the app runs *either way* — it just quietly stops doing
real analysis if the key did not load.

1. In the app, click **Settings** in the left sidebar
2. Look at the **Providers** table
3. The **Model** row should say `anthropic · claude-opus-5` with a green
   **Live** badge

If it says `mock` and **Fallback**, the key did not load. Run the setup again
and re-paste it — check you did not include a space at either end.

You can also tell at a glance from the home page: if there is an amber
**"Deterministic mode"** banner, the key is not working.

---

## Part 6 — Your first real discovery

The app comes with an example project so you can look around. But to do real
work:

1. Click **Start discovery**
2. Type your actual question, the way you would say it to a colleague.
   For example: *"Why are enterprise customers churning in year two?"*
3. Pick your role from the **Your lens** dropdown
4. Click **Start discovery**
5. Go to **Research** → **Build research plan**

   Read the plan. This is the point where you have the most influence — you can
   untick research questions you do not care about, and see which sources it
   intends to use.
6. Click **Run research**. This takes a few minutes. You will see progress per
   question, so you can watch what it is finding.
7. Then work down the sidebar: **Findings** → **Analysis** →
   **Opportunities** → **Artifacts**

Each step has a button that tells you what to do next. The overview page always
shows your recommended next action.

---

## If something goes wrong

**The installer stopped and showed red text.**
It tells you which step failed and prints the relevant lines. Copy those lines
and paste them to Claude with "setup failed at this step" — that is enough to
diagnose it. The full detail is saved in `setup-log.txt` in the app folder.

**"Docker Desktop is not running."**
Open the Docker Desktop app, wait for the whale icon to settle, try again.

**Everything in the app says "Not established."**
Your AI key is not loading. Check Settings → Providers, then re-run setup.

**Research comes back with sources that say "PLACEHOLDER".**
That is the search key missing, not a bug. Re-run setup and add a Tavily key.

**The browser says it cannot connect to localhost:3000.**
The app is still starting — wait 30 seconds and refresh. If the black window
has closed or shows an error, start it again.

**Windows: "python is not recognized."**
Python was installed without being added to PATH. Reinstall it and tick
**"Add python.exe to PATH"** on the first screen.

---

## If you would rather not do any of this

Send whoever is technical on your team this one message:

> Please set up this repo on a server or my laptop and give me a URL:
> `github.com/ShivangiJain1897/AI-Discovery`, branch
> `claude/youthful-cannon-njtlw3`. Setup instructions are in `SETUP.md`,
> deployment in `DEPLOY.md`. It needs Postgres 16 with pgvector and an
> `ANTHROPIC_API_KEY`. Should take about 30 minutes.

That is genuinely the fastest path if the option exists.
