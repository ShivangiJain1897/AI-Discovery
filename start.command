#!/usr/bin/env bash
cd "$(dirname "$0")"
./start.sh
printf "\nThe app has stopped. Press Enter to close this window."
read -r _
