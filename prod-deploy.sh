#!/bin/bash
# Deploy to production - run these on your production server

# 1. Update code
cd /var/www/pvpstrategygame
git pull origin main
npm install

# 2. Apply K8s resources (if needed)
# kubectl apply -f k8s/namespace.yaml
# kubectl apply -f k8s/traefik-rbac.yaml

# 3. Restart backend
pm2 restart fortezza

# 4. Check status
pm2 list | grep fortezza
