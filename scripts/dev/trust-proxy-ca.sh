#!/usr/bin/env bash
# Let the browser reach Supabase from a cloud session.
#
# In a Claude Code cloud container every outbound HTTPS connection goes through an agent
# proxy that re-terminates TLS, so anything that does not trust the proxy's CA sees
# ERR_CERT_AUTHORITY_INVALID. curl, node and git are configured for it by environment
# variables. Chromium is not: it reads its own NSS store at ~/.pki/nssdb, and that store
# was empty — so the browser could load the app from localhost and then fail every call to
# Supabase, landing on the login screen with no error anyone would connect to a certificate.
#
# The visible symptom was nine specs that "just don't run in the cloud" — preflight,
# layoutcheck, onboarding, reset — and no way to look at the real app as a signed-in user.
# The owner remembered it working once, and he was right: the store is per-container and the
# CA rotates, so it breaks again on its own (29.09).
#
# This trusts a named CA that every other tool in the container already trusts. It is NOT
# --ignore-certificate-errors and NOT ignoreHTTPSErrors: verification stays on, and a
# certificate from anywhere else is still rejected.
#
# Safe to run anywhere: without the proxy CA present — a laptop, CI — it does nothing.

set -euo pipefail

CA=/root/.ccr/agent-proxy-ca.crt
DB="${HOME}/.pki/nssdb"
NICK=ccr-agent-proxy

[ -f "$CA" ] || exit 0            # not a proxied container — nothing to do

if ! command -v certutil >/dev/null 2>&1; then
  # libnss3-tools is not in the base image. Best-effort: if it cannot be installed the
  # browser simply keeps its current trust, and the specs that need the network say why.
  (apt-get update -qq && apt-get install -y libnss3-tools) >/dev/null 2>&1 || {
    echo "trust-proxy-ca: certutil unavailable — browser will not reach the network" >&2
    exit 0
  }
fi

mkdir -p "$DB"
[ -f "$DB/cert9.db" ] || certutil -d "sql:$DB" -N --empty-password >/dev/null 2>&1 || true

# Re-import every time rather than only when absent: the CA rotates, and a stale one in the
# store fails exactly like a missing one while looking installed.
certutil -d "sql:$DB" -D -n "$NICK" >/dev/null 2>&1 || true
certutil -d "sql:$DB" -A -t "C,," -n "$NICK" -i "$CA"

echo "trust-proxy-ca: browser now trusts the agent proxy CA"
