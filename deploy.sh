#!/bin/bash
echo "=== Deployment started at $(date) ==="

cd /home/bufka/site

echo "Pulling latest changes from main branch..."
if git pull --ff-only origin main; then
    echo "✅ Git pull successful - files updated."
else
    echo "❌ Git pull failed (possible conflict). Aborting deploy."
    exit 1
fi

echo "Installing / updating npm dependencies..."
npm install --omit=dev
echo "✅ npm install done."

echo "Restarting PM2 process 'ntnewHorizons'..."
pm2 restart ntnewHorizons

echo "✅ Deployment finished successfully at $(date)"
echo "========================================"
