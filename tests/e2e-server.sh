#!/usr/bin/env bash
#
# End-to-end server test for PhonePad.
#
# Starts the server, exercises the HTTP API and static assets with curl,
# asserts the responses, then stops the server and confirms port 8888 is freed.
# Exits non-zero on the first failure. Safe to run in CI (no GUI input needed).
#
# Usage:  bash tests/e2e-server.sh      (or: npm test)
#
set -u

# ---- config --------------------------------------------------------------
PORT=8888
BASE="http://localhost:${PORT}"
# Resolve project root from this script's location (tests/ -> ..)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_ENTRY="${ROOT}/server/index.js"
LOG="$(mktemp -t phonepad_e2e.XXXXXX.log)"

PASS=0
FAIL=0
SERVER_PID=""

# ---- pretty output -------------------------------------------------------
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
info()  { printf '  %s\n' "$1"; }

pass() { PASS=$((PASS+1)); green "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); red   "  ✗ $1"; }

# Assert that the command's output contains a substring.
# usage: assert_contains "<description>" "<haystack>" "<needle>"
assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -q -- "$needle"; then
    pass "$desc"
  else
    fail "$desc"
    info "expected to find: $needle"
    info "actual:           ${haystack:0:200}"
  fi
}

# Assert an HTTP GET returns status 200.
# usage: assert_http_200 "<description>" "<path>"
assert_http_200() {
  local desc="$1" path="$2" code
  code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${path}")"
  if [ "$code" = "200" ]; then
    pass "$desc (HTTP $code)"
  else
    fail "$desc (HTTP $code, expected 200)"
  fi
}

# ---- cleanup -------------------------------------------------------------
cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null
  fi
  # Belt-and-suspenders: free the port regardless of how the server was spawned.
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi
  rm -f "${LOG}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---- preflight -----------------------------------------------------------
echo "PhonePad end-to-end server test"
echo "==============================="

if ! command -v curl >/dev/null 2>&1; then
  red "curl is required but not found."; exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  red "node is required but not found."; exit 2
fi

# Port must be free before we start.
if command -v lsof >/dev/null 2>&1 && lsof -i:"${PORT}" >/dev/null 2>&1; then
  red "Port ${PORT} is already in use. Stop the running server first (see docs/UNINSTALL.md)."
  exit 2
fi

# ---- start server --------------------------------------------------------
info "Starting server: node server/index.js"
cd "${ROOT}"
node "${SERVER_ENTRY}" >"${LOG}" 2>&1 &
SERVER_PID=$!

# Wait up to ~10s for the HTTP API to answer.
READY=0
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "${BASE}/api/server/info"; then
    READY=1; break
  fi
  sleep 0.2
done

if [ "${READY}" != "1" ]; then
  red "Server did not become ready within timeout. Log:"
  sed 's/^/    /' "${LOG}"
  exit 1
fi
pass "server started and is answering on :${PORT}"

# ---- API assertions ------------------------------------------------------
echo
echo "API endpoints:"

INFO="$(curl -s "${BASE}/api/server/info")"
assert_contains "/api/server/info returns port ${PORT}" "$INFO" "\"port\":${PORT}"
assert_contains "/api/server/info returns a platform"   "$INFO" "\"platform\""
assert_contains "/api/server/info returns a url"        "$INFO" "\"url\""

SESS="$(curl -s "${BASE}/api/sessions")"
assert_contains "/api/sessions reports active count" "$SESS" "\"active\""
assert_contains "/api/sessions reports max"          "$SESS" "\"max\""

ACTIONS="$(curl -s "${BASE}/api/gestures/actions")"
assert_contains "/api/gestures/actions lists click_left"      "$ACTIONS" "click_left"
assert_contains "/api/gestures/actions lists mission_control" "$ACTIONS" "mission_control"

GEST="$(curl -s "${BASE}/api/gestures")"
assert_contains "/api/gestures returns gesture map (tap_1)" "$GEST" "tap_1"

# ---- static assets -------------------------------------------------------
echo
echo "Static assets:"
assert_http_200 "GET / (trackpad page)" "/"
assert_http_200 "GET /manifest.json"    "/manifest.json"
assert_http_200 "GET /config (config UI)" "/config"

INDEX="$(curl -s "${BASE}/")"
assert_contains "index page is branded PhonePad" "$INDEX" "<title>PhonePad</title>"

MANIFEST="$(curl -s "${BASE}/manifest.json")"
assert_contains "manifest name is PhonePad" "$MANIFEST" "\"name\": \"PhonePad\""

# A bogus path should 404 (confirms routing, not a catch-all 200).
NOTFOUND_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/definitely-not-a-real-path")"
if [ "${NOTFOUND_CODE}" = "404" ]; then
  pass "unknown path returns 404"
else
  fail "unknown path returns 404 (got ${NOTFOUND_CODE})"
fi

# ---- stop & confirm freed ------------------------------------------------
echo
echo "Shutdown:"
kill "${SERVER_PID}" 2>/dev/null
# Fallback: also release the port in case the process was reparented.
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"${PORT}" 2>/dev/null | xargs kill 2>/dev/null || true
fi
# Wait for the process to exit and the port to be released.
GONE=0
for _ in $(seq 1 25); do
  if ! curl -s -o /dev/null "${BASE}/api/server/info"; then
    GONE=1; break
  fi
  sleep 0.2
done
if [ "${GONE}" = "1" ]; then
  pass "server stopped (API no longer answers)"
else
  fail "server still answering after stop"
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -i:"${PORT}" >/dev/null 2>&1; then
    fail "port ${PORT} still in use after shutdown"
  else
    pass "port ${PORT} is free after shutdown"
  fi
fi
SERVER_PID=""  # already stopped; avoid double-kill in cleanup

# ---- summary -------------------------------------------------------------
echo
echo "-------------------------------"
if [ "${FAIL}" -eq 0 ]; then
  green "All ${PASS} checks passed."
  exit 0
else
  red "${FAIL} check(s) failed, ${PASS} passed."
  exit 1
fi
