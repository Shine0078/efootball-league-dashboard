#!/usr/bin/env bash
# Setup Turso for persistent production storage
# Requires: Turso CLI (https://turso.tech)
set -euo pipefail

echo "=== Turso Setup for eFootball League Dashboard ==="
echo ""

# Check Turso CLI
if ! command -v turso &>/dev/null; then
  echo "Installing Turso CLI..."
  curl -fsSL https://get.turso.dev | sh
  export PATH="$HOME/.turso:$PATH"
fi

# Login
echo "Logging into Turso..."
turso auth login

# Create database
echo ""
echo "Creating database..."
turso db create efootball-league

# Get URL
DB_URL=$(turso db show efootball-league --url)
echo "Database URL: $DB_URL"

# Create auth token
DB_TOKEN=$(turso db tokens create efootball-league)
echo "Auth Token: $DB_TOKEN"

# Push Prisma schema
echo ""
echo "Pushing Prisma schema to Turso..."
TURSO_DATABASE_URL="$DB_URL" TURSO_DATABASE_TURSO_AUTH_TOKEN="$DB_TOKEN" \
  npx prisma db push --skip-generate

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Set these environment variables on Vercel:"
echo "  TURSO_DATABASE_URL=$DB_URL"
echo "  TURSO_DATABASE_TURSO_AUTH_TOKEN=$DB_TOKEN"
echo ""
echo "Or add them to your .env file for local testing with Turso."
