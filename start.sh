#!/usr/bin/env bash
#
# Starts the platform and opens it in the browser.
# Safe to run every day; setup.sh only needs running once.
#
set -uo pipefail
cd "$(dirname "$0")"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
GREEN=$'\033[32m'; RED=$'\033[31m'; TEAL=$'\033[36m'

if [ ! -f .env ] || [ ! -d apps/api/.venv ]; then
  printf "\n${RED}${BOLD}  This has not been set up yet.${RESET}\n\n"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    printf "  Double-click ${BOLD}setup.command${RESET} first.\n\n"
  else
    printf "  Run ${BOLD}./setup.sh${RESET} first.\n\n"
  fi
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf "\n${RED}${BOLD}  Docker Desktop is not running.${RESET}\n\n"
  printf "  Open the ${BOLD}Docker Desktop${RESET} app, wait about 30 seconds,\n"
  printf "  then run this again.\n\n"
  exit 1
fi

printf "\n${TEAL}${BOLD}  AI Product Discovery Platform${RESET}\n\n"
printf "  ${DIM}Starting the database…${RESET}\n"
make db-up >/dev/null 2>&1 || {
  printf "${RED}  Could not start the database. Is Docker Desktop running?${RESET}\n\n"
  exit 1
}
printf "  ${GREEN}✓${RESET} Database ready\n"

# Opens the browser once the web server is actually answering, so the user
# does not land on a connection error.
(
  for _ in $(seq 1 60); do
    if curl -s --max-time 2 http://localhost:3000 >/dev/null 2>&1; then
      sleep 1
      case "$(uname -s)" in
        Darwin) open http://localhost:3000 ;;
        Linux)  command -v xdg-open >/dev/null && xdg-open http://localhost:3000 ;;
      esac
      break
    fi
    sleep 2
  done
) &

printf "  ${DIM}Starting the app — this takes about 20 seconds…${RESET}\n\n"
printf "  It will open at ${TEAL}${BOLD}http://localhost:3000${RESET}\n"
printf "  ${DIM}Leave this window open while you use it.${RESET}\n"
printf "  ${DIM}To stop: close this window, or press Ctrl+C.${RESET}\n\n"
printf "${DIM}────────────────────────────────────────────────────────${RESET}\n\n"

exec make dev
