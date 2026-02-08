#!/bin/bash
# Strip `key` and `update_url` from build/manifest.json for Chrome Web Store upload.
# These fields are needed for self-hosted distribution but CWS rejects them.

MANIFEST="build/manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: $MANIFEST not found. Run build first." >&2
  exit 1
fi

node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
delete m.key;
delete m.update_url;
fs.writeFileSync('$MANIFEST', JSON.stringify(m, null, 2) + '\n');
console.log('Stripped key and update_url from $MANIFEST for CWS upload');
"
