#!/bin/sh

set -eu

DB_PATH="prisma/test.db"

rm -f "$DB_PATH" "${DB_PATH}-journal" "${DB_PATH}-shm" "${DB_PATH}-wal"

for migration in prisma/migrations/*/migration.sql
do
  /usr/bin/sqlite3 "$DB_PATH" < "$migration"
done
