#!/bin/bash
# Syncs the version from package.json to manifest.json

VERSION=$(node -p "require('./package.json').version")
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf8'));
manifest.version = '$VERSION';
fs.writeFileSync('./public/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
"
echo "Synced version $VERSION to manifest.json"
