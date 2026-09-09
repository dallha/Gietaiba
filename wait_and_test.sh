#!/bin/bash
echo "Attente du déploiement sur Render (checking /api/voyages)..."
for i in {1..120}; do
  RES=$(curl -s https://gietaiba.onrender.com/api/voyages)
  if [[ "$RES" == *"NEON_SESSION_INVALID"* ]]; then
    echo -e "\n========================================"
    echo "🚀 DÉPLOIEMENT DÉTECTÉ EN PRODUCTION !"
    echo "========================================"
    npx tsx scripts/validate-lot2a.ts
    exit 0
  fi
  sleep 15
done
echo "Timeout: Le déploiement n'a pas été détecté dans les 30 minutes."
