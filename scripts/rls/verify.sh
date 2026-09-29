#!/usr/bin/env bash
# Prove the row-level security policies actually isolate one apartment from another.
#
# RLS is the only part of this app that cannot be tested anywhere else: the e2e harness
# stubs the REST layer wholesale and never evaluates a policy, and the hosted database is
# shared with production. So this spins up a throwaway Postgres, applies the shim plus
# every migration in order, and runs scripts/rls/isolation.sql against it.
#
# It is the gate for migration 051 (sharing an apartment between up to three people): the
# danger there is not that sharing fails to work — that is visible immediately — but that
# it works AND quietly widens, letting one family read another's money.
#
#   scripts/rls/verify.sh          # build and check
#   KEEP=1 scripts/rls/verify.sh   # leave the cluster running to poke at it
#
# Needs the postgres 16 binaries (no running server, no docker, no network). Works both
# as root (this project's container) and as an ordinary user (a CI runner, a laptop).
set -euo pipefail

BIN=/usr/lib/postgresql/16/bin
PORT=${RLS_PORT:-55432}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

[ -x "$BIN/initdb" ] || { echo "postgres 16 binaries not found at $BIN"; exit 2; }

# Where the cluster lives, and who runs it. Postgres refuses to run as root, so as root we
# hand the work to the postgres system user and put the data somewhere that user owns; as
# an ordinary user (a CI runner, a laptop) we run it directly in a writable temp dir.
# The first version of this script assumed root and failed on the runner at `mkdir
# /var/lib/postgresql` — which is what the migration gate then correctly refused over.
if [ "$(id -u)" = "0" ]; then
  DATA=/var/lib/postgresql/rlsdata
  SOCK=/tmp/pgsock
  run() { su postgres -c "PATH=$BIN:\$PATH $1"; }
  OWN=postgres:postgres
else
  DATA="${TMPDIR:-/tmp}/rlsdata"
  SOCK="${TMPDIR:-/tmp}/pgsock"
  run() { PATH="$BIN:$PATH" bash -c "$1"; }
  OWN=""
fi

if ! "$BIN/pg_isready" -h "$SOCK" -p "$PORT" >/dev/null 2>&1; then
  echo "· starting a throwaway cluster"
  rm -rf "$DATA"; mkdir -p "$DATA" "$SOCK"
  [ -n "$OWN" ] && chown "$OWN" "$DATA" "$SOCK"
  run "initdb -D $DATA -U postgres --auth=trust" >/dev/null
  # listen_addresses empty ⇒ unix socket only; nothing is exposed.
  run "pg_ctl -D $DATA -o '-p $PORT -k $SOCK -c listen_addresses=' -l $SOCK/pg.log start" >/dev/null
  for _ in $(seq 1 20); do
    "$BIN/pg_isready" -h "$SOCK" -p "$PORT" >/dev/null 2>&1 && break
    sleep 1
  done
fi

export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres

echo "· rebuilding the database from scratch"
psql -q -c "drop database if exists rls" -c "create database rls" >/dev/null
psql -q -d rls -v ON_ERROR_STOP=1 -f "$ROOT/scripts/rls/shim.sql" >/dev/null

echo "· applying $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! out=$(psql -q -d rls -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
    echo "  ✗ $(basename "$f")"
    echo "$out" | grep -E "ERROR|LINE" | head -5
    exit 1
  fi
done

echo "· checking isolation"
# Once, not twice: the script seeds rows, so a second run would collide with the first
# and report a duplicate key instead of the thing being tested.
set +e
out=$(psql -d rls -v ON_ERROR_STOP=1 -f "$ROOT/scripts/rls/isolation.sql" 2>&1)
code=$?
set -e
echo "$out" | grep -E "ok ·|FAIL|ERROR|PASSED" | sed 's/^NOTICE:  /  /;s/^psql:[^ ]* //'
echo
if [ $code -eq 0 ]; then
  echo "RLS OK — no leak between apartments"
else
  echo "RLS FAILED"
  exit 1
fi

if [ -z "${KEEP:-}" ]; then
  run "pg_ctl -D $DATA -m immediate stop" >/dev/null 2>&1 || true
fi
