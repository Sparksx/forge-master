#!/bin/sh
# Skip prisma db push if schema hasn't changed since last deploy.
# Stores the schema hash in the _prisma_schema_hash table.
set -e

SCHEMA_FILE="prisma/schema.prisma"
PRISMA="./node_modules/.bin/prisma"
CURRENT_HASH=$(sha256sum "$SCHEMA_FILE" | cut -d' ' -f1)

# Try to read the stored hash from the database (table may not exist yet)
STORED_HASH=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT hash FROM _prisma_schema_hash LIMIT 1\`
  .then(r => { console.log(r[0]?.hash || ''); process.exit(0); })
  .catch(() => { console.log(''); process.exit(0); })
  .finally(() => p.\$disconnect());
" 2>/dev/null || echo "")

if [ "$CURRENT_HASH" = "$STORED_HASH" ]; then
  echo "Schema unchanged (hash: ${CURRENT_HASH:0:12}...), skipping prisma db push"
  exit 0
fi

echo "Schema changed, running prisma db push..."
$PRISMA db push --accept-data-loss --skip-generate

# Store the new hash (create table if needed)
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.\$executeRawUnsafe('CREATE TABLE IF NOT EXISTS _prisma_schema_hash (id INTEGER PRIMARY KEY DEFAULT 1, hash TEXT NOT NULL)');
  await p.\$executeRawUnsafe('INSERT INTO _prisma_schema_hash (id, hash) VALUES (1, \$1) ON CONFLICT (id) DO UPDATE SET hash = \$1', '$CURRENT_HASH');
  await p.\$disconnect();
  console.log('Schema hash updated: ${CURRENT_HASH:0:12}...');
})();
"
