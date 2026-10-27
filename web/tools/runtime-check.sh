#!/usr/bin/env bash
# Runtime check: boot the dev server, prove the app and its wired modules
# actually compile and serve, then kill it. The server is bounded by `timeout`
# AND explicitly killed, because a previous task leaked one and pegged the CPU.
set -u
cd "$(dirname "$0")/.."

PORT=5199
FAILED=0
LOG=$(mktemp)

timeout 60 npx vite --host 127.0.0.1 --port "$PORT" --strictPort > "$LOG" 2>&1 &
VITE_PID=$!

# wait for readiness (max ~15s)
for i in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  sleep 0.5
done

echo "=== index.html ==="
curl -s -o /dev/null -w "status=%{http_code}\n" "http://127.0.0.1:$PORT/"
curl -s "http://127.0.0.1:$PORT/" | grep -o 'id="eng-panel"' | head -1

echo "=== entry module (main.js, served+transformed) ==="
curl -s -o /dev/null -w "status=%{http_code}\n" "http://127.0.0.1:$PORT/third_party/aquarium-editor/main.js"

echo "=== wired modules compile through vite ==="
for m in src/ui/mount.tsx src/ui/ParamForm.tsx src/ui/MaterialPanel.tsx \
         src/render/tankBridge.ts src/solver/solve.ts src/rules/index.ts \
         src/share/urlState.ts src/export/xlsx.ts src/export/drawing.ts; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/$m")
  echo "  $m -> $code"
  if [ "$code" != "200" ]; then
    echo "FAIL: $m did not transform (status $code)" >&2
    FAILED=1
  fi
done

echo "=== vite log (errors only) ==="
grep -iE "error|failed|cannot|unexpected" "$LOG" | head -10 || echo "  (no errors)"
echo "=== vite log (head) ==="
head -6 "$LOG"

echo "=== shutdown ==="
kill "$VITE_PID" 2>/dev/null
wait "$VITE_PID" 2>/dev/null
# belt and braces: make sure nothing is left listening. A leaked server is a
# failure, not a footnote -- a previous task left one spinning for minutes.
RELEASED=0
for i in $(seq 1 10); do
  if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; then
    RELEASED=1
    break
  fi
  sleep 0.5
done
rm -f "$LOG"

if [ "$RELEASED" -ne 1 ]; then
  echo "FAIL: port $PORT still answering after shutdown" >&2
  exit 1
fi
echo "  port $PORT released"

if [ "$FAILED" -ne 0 ]; then
  echo "FAIL: one or more wired modules failed to transform" >&2
  exit 1
fi
echo "  all wired modules transformed"

