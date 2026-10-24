#!/usr/bin/env bash
# usage: one.sh SRC OUT PROMPTFILE LOG
timeout 280 bash ~/.claude/skills/codex-vision/scripts/codex-vision.sh edit --fresh "$1" "$(cat "$3")" --out "$2" > "$4" 2>&1
echo "exit $?" >> "$4"
