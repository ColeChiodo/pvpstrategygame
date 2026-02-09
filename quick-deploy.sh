#!/bin/bash
# Quick deploy script - pushes to main and restarts production
# Usage: ./quick-deploy.sh user@host.com

set -e

HOST=${1:-""}
if [ -z "$HOST" ]; then
    echo "Usage: ./quick-deploy.sh user@host.com"
    exit 1
fi

echo "Quick deploying to $HOST..."

# Push current changes to main
git push origin main

# Deploy to production
ssh "$HOST" << 'SSHEOF'
set -e

cd /var/www/pvpstrategygame

# Pull and restart
git pull origin main
npm install

# Ensure CRD exists
kubectl get crd ingressroutes.traefik.containo.us >/dev/null 2>&1 || \
    kubectl apply -f - <<'CRDEOF'
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: ingressroutes.traefik.containo.us
spec:
  group: traefik.containo.us
  names:
    kind: IngressRoute
    plural: ingressroutes
  scope: Namespaced
  versions:
  - name: v1alpha1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
CRDEOF

pm2 restart fortezza
sleep 3
pm2 list | grep fortezza
echo "Done!"
SSHEOF

echo "Quick deploy complete!"
