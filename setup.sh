#!/usr/bin/env bash
#
# One-command setup for the AI Product Discovery Platform.
#
# Written for someone who does not work in a terminal: it checks what is
# missing, says so in plain language with a download link, and stops rather
# than failing halfway through with a stack trace.
#
set -uo pipefail
cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; TEAL=$'\033[36m'

ok()    { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
fail()  { printf "  ${RED}✗${RESET} %s\n" "$1"; }
step()  { printf "\n${BOLD}%s${RESET}\n" "$1"; }
info()  { printf "    ${DIM}%s${RESET}\n" "$1"; }

banner() {
  printf "\n${TEAL}${BOLD}"
  printf "  AI Product Discovery Platform\n"
  printf "${RESET}${DIM}  Setting up on this computer. This takes about 5 minutes.${RESET}\n"
}

# Something is missing: explain it once, in plain language, and stop.
missing() {
  local what="$1" why="$2" url="$3"
  printf "\n${RED}${BOLD}  Stopped: %s is not installed.${RESET}\n\n" "$what"
  printf "  %s\n\n" "$why"
  printf "  ${BOLD}What to do:${RESET}\n"
  printf "    1. Open this link:  ${TEAL}%s${RESET}\n" "$url"
  printf "    2. Download and install it (accept all the defaults).\n"
  printf "    3. Run this setup again.\n\n"
  exit 1
}

banner

# ── 1. Check what is installed ───────────────────────────────

step "Step 1 of 6 — Checking what this computer already has"

if command -v python3 >/dev/null 2>&1; then
  PY_VERSION="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo "0.0")"
  PY_OK="$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 11) else 0)' 2>/dev/null || echo 0)"
  if [ "$PY_OK" = "1" ]; then
    ok "Python $PY_VERSION"
  else
    missing "a recent enough Python" \
      "You have Python $PY_VERSION, but this needs 3.11 or newer." \
      "https://www.python.org/downloads/"
  fi
else
  missing "Python" \
    "Python is the programming language the research engine runs on." \
    "https://www.python.org/downloads/"
fi

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then
    ok "Node $(node -v)"
  else
    missing "a recent enough Node" \
      "You have Node $(node -v), but this needs version 20 or newer." \
      "https://nodejs.org/"
  fi
else
  missing "Node" \
    "Node runs the part of the app you see in your browser." \
    "https://nodejs.org/"
fi

if ! command -v docker >/dev/null 2>&1; then
  missing "Docker Desktop" \
    "Docker runs the database that stores your research evidence." \
    "https://www.docker.com/products/docker-desktop/"
fi

if docker info >/dev/null 2>&1; then
  ok "Docker Desktop (running)"
else
  printf "\n${RED}${BOLD}  Stopped: Docker Desktop is installed but not running.${RESET}\n\n"
  printf "  ${BOLD}What to do:${RESET}\n"
  printf "    1. Open the ${BOLD}Docker Desktop${RESET} app from your Applications folder\n"
  printf "       (or the Start menu on Windows).\n"
  printf "    2. Wait until its whale icon stops animating — about 30 seconds.\n"
  printf "    3. Run this setup again.\n\n"
  exit 1
fi

# ── 2. Configuration file ────────────────────────────────────

step "Step 2 of 6 — Preparing your settings file"

if [ -f .env ]; then
  ok "Settings file already exists (keeping your keys)"
else
  cp .env.example .env
  ok "Created your settings file"
fi

read_existing_key() {
  python3 - "$1" <<'PYEOF'
import re, sys, pathlib
name = sys.argv[1]
text = pathlib.Path(".env").read_text()
match = re.search(rf"^{name}=(.*)$", text, re.M)
print((match.group(1).strip() if match else ""))
PYEOF
}

# Written with python rather than sed so a key containing / or & is safe.
write_key() {
  python3 - "$1" "$2" <<'PYEOF'
import re, sys, pathlib
name, value = sys.argv[1], sys.argv[2]
path = pathlib.Path(".env")
text = path.read_text()
if re.search(rf"^{name}=", text, re.M):
    text = re.sub(rf"^{name}=.*$", f"{name}={value}", text, count=1, flags=re.M)
else:
    text = text.rstrip("\n") + f"\n{name}={value}\n"
path.write_text(text)
PYEOF
}

# ── 3. API key ───────────────────────────────────────────────

step "Step 3 of 6 — Connecting the AI"

EXISTING_ANTHROPIC="$(read_existing_key ANTHROPIC_API_KEY)"

if [ -n "$EXISTING_ANTHROPIC" ]; then
  ok "AI key already saved"
else
  printf "\n  The platform needs one key to do its research and analysis.\n\n"
  printf "  ${BOLD}Where to get it:${RESET}\n"
  printf "    1. Open  ${TEAL}https://console.anthropic.com${RESET}\n"
  printf "    2. Sign in, then click ${BOLD}API Keys${RESET} in the left sidebar\n"
  printf "    3. Click ${BOLD}Create Key${RESET}, then copy it\n"
  printf "       ${DIM}(it is a long string starting with sk-ant-)${RESET}\n\n"
  printf "  Paste it below and press Enter.\n"
  printf "  ${DIM}Or just press Enter to skip — the app will still run, but it will${RESET}\n"
  printf "  ${DIM}say \"Not established\" instead of doing real analysis.${RESET}\n\n"
  printf "  ${BOLD}Paste your key:${RESET} "
  read -r ANTHROPIC_INPUT

  if [ -z "${ANTHROPIC_INPUT:-}" ]; then
    warn "Skipped — you can add it later by running this setup again"
  elif [[ "$ANTHROPIC_INPUT" != sk-ant-* ]]; then
    warn "That does not look like an Anthropic key (they start with sk-ant-)"
    printf "    Saving it anyway. If the app says \"Deterministic mode\" later,\n"
    printf "    run this setup again and re-paste it.\n"
    write_key ANTHROPIC_API_KEY "$ANTHROPIC_INPUT"
  else
    write_key ANTHROPIC_API_KEY "$ANTHROPIC_INPUT"
    ok "AI key saved"
  fi
fi

# ── 4. Search key ────────────────────────────────────────────

step "Step 4 of 6 — Connecting web research (optional)"

EXISTING_TAVILY="$(read_existing_key TAVILY_API_KEY)"

if [ -n "$EXISTING_TAVILY" ]; then
  ok "Web search key already saved"
else
  printf "\n  This lets the platform actually read the web. Without it, research\n"
  printf "  returns placeholder results instead of real sources.\n\n"
  printf "  ${BOLD}Where to get it (free):${RESET}\n"
  printf "    1. Open  ${TEAL}https://tavily.com${RESET}\n"
  printf "    2. Sign up, then copy the key from your dashboard\n"
  printf "       ${DIM}(it starts with tvly-)${RESET}\n\n"
  printf "  ${BOLD}Paste your key${RESET} ${DIM}(or press Enter to skip)${RESET}${BOLD}:${RESET} "
  read -r TAVILY_INPUT

  if [ -z "${TAVILY_INPUT:-}" ]; then
    warn "Skipped — research will use placeholder sources"
  else
    write_key TAVILY_API_KEY "$TAVILY_INPUT"
    ok "Web search key saved"
  fi
fi

# ── 5. Install and prepare ───────────────────────────────────

step "Step 5 of 6 — Installing the app"
info "This is the slow part — about 3 minutes. Please leave it running."

LOG="setup-log.txt"
: > "$LOG"

run_quietly() {
  local label="$1"; shift
  printf "  ${DIM}…%s${RESET}\r" "$label"

  # Each step writes to its own file as well as the combined log, so a failure
  # report shows the step that actually failed rather than warnings left over
  # from the step before it.
  local step_log; step_log="$(mktemp)"
  if "$@" >"$step_log" 2>&1; then
    { printf "\n===== %s =====\n" "$label"; cat "$step_log"; } >>"$LOG"
    rm -f "$step_log"
    printf "\033[2K\r"
    ok "$label"
  else
    { printf "\n===== FAILED: %s =====\n" "$label"; cat "$step_log"; } >>"$LOG"
    printf "\033[2K\r"
    fail "$label"
    printf "\n${RED}${BOLD}  Setup could not finish.${RESET}\n\n"
    printf "  It got stuck on:  ${BOLD}%s${RESET}\n\n" "$label"
    printf "  ${BOLD}What to do:${RESET} paste the lines below to Claude and ask what\n"
    printf "  went wrong. The full details are also in ${BOLD}%s${RESET}.\n\n" "$LOG"
    printf "${DIM}  ────────────────────────────────────────────────────────${RESET}\n"
    grep -viE '^\s*$|npm (warn|notice)|vulnerabilities|npm audit|npm fund|run \`npm' "$step_log" \
      | tail -n 8 | sed 's/^/    /'
    printf "${DIM}  ────────────────────────────────────────────────────────${RESET}\n\n"
    rm -f "$step_log"
    exit 1
  fi
}

run_quietly "Installing the research engine"  make install-api
run_quietly "Installing the web interface"    make install-web
run_quietly "Starting the database"           make db-up
run_quietly "Creating the database tables"    make migrate
run_quietly "Loading the example project"     make seed

# ── 6. Done ──────────────────────────────────────────────────

step "Step 6 of 6 — Ready"

FINAL_KEY="$(read_existing_key ANTHROPIC_API_KEY)"
if [ -z "$FINAL_KEY" ]; then
  printf "\n"
  warn "No AI key was set, so the app will run in limited mode."
  info "Run this setup again any time to add one."
fi

printf "\n${GREEN}${BOLD}  Setup is complete.${RESET}\n\n"
printf "  ${BOLD}To use the platform:${RESET}\n"
if [[ "$(uname -s)" == "Darwin" ]]; then
  printf "    Double-click  ${BOLD}start.command${RESET}  in this folder.\n"
else
  printf "    Run  ${BOLD}./start.sh${RESET}  in this folder.\n"
fi
printf "\n  It will open ${TEAL}http://localhost:3000${RESET} in your browser.\n"
printf "\n  ${DIM}You only need to run setup once. After this, just start it.${RESET}\n\n"

printf "  ${BOLD}Start it now?${RESET} ${DIM}[Y/n]${RESET} "
read -r START_NOW
if [[ -z "${START_NOW:-}" || "$START_NOW" =~ ^[Yy] ]]; then
  exec ./start.sh
fi
