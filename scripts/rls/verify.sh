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
# Needs the postgres 16 binaries (no server, no docker, no network).
set -euo pipefail

BIN=/usr/lib/postgresql/16/bin
DATA=/var/lib/postgresql/rlsdata
SOCK=/tmp/pgsock
PORT=55432
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

[ -x "$BIN/initdb" ] || { echo "postgres 16 binaries not found at $BIN"; exit 2; }

# The cluster refuses to run as root, so it runs as the postgres system user.
as_pg() { su postgres -c "PATH=$BIN:\$PATH $1"; }

if ! "$BIN/pg_isready" -h "$SOCK" -p "$PORT" >/dev/null 2>&1; then
  echo "· starting a throwaway cluster"
  rm -rf "$DATA"; mkdir -p "$DATA" "$SOCK"
  chown postgres:postgres "$DATA" "$SOCK"
  as_pg "initdb -D $DATA -U postgres --auth=trust" >/dev/null
  # listen_addresses empty ⇒ unix socket only; nothing is exposed.
  as_pg "pg_ctl -D $DATA -o '-p $PORT -k $SOCK -c listen_addresses=' -l $SOCK/pg.log start" >/dev/null
  sleep 2
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
  as_pg "pg_ctl -D $DATA -m immediate stop" >/dev/null 2>&1 || true
fi
