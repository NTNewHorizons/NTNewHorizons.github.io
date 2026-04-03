#!/bin/bash
echo "=== Deployment started at $(date) ==="

cd /home/bufka/site

# Pull latest changes safely
git fetch --prune --tags origin
git reset --hard origin/main

echo "Website files updated."

# Restart the Express site
pm2 restart ntnewHorizons

echo "=== Deployment finished successfully at $(date) ==="
