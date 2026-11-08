#!/usr/bin/env bash
# Menjalankan migrasi + tes di Postgres lokal (bukan Supabase).
# Pemakaian: DATABASE_URL=postgres://user@localhost:5432/postgres ./supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?set DATABASE_URL ke database kosong}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
PGOPTIONS="--client-min-messages=warning" "${PSQL[@]}" -c 'drop schema if exists public cascade; create schema public; drop schema if exists auth cascade; drop schema if exists storage cascade;'
"${PSQL[@]}" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo ">> $f"; "${PSQL[@]}" -f "$f"; done
for f in tests/0*_test.sql; do echo ">> $f"; "${PSQL[@]}" -f "$f"; done
