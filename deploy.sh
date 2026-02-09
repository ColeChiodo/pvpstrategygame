#!/bin/bash
set -e

echo "========================================="
echo "Fortezza Production Deployment Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in correct directory
if [ ! -f "backend/src/services/k8s.ts" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Get production host from environment or prompt
PRODUCTION_HOST=${1:-""}
if [ -z "$PRODUCTION_HOST" ]; then
    read -p "Enter production host (e.g., user@your-server.com): " PRODUCTION_HOST
fi

if [ -z "$PRODUCTION_HOST" ]; then
    print_error "Production host is required"
    exit 1
fi

print_status "Deploying to $PRODUCTION_HOST..."

# Step 1: Check for uncommitted changes
echo ""
echo "Step 1: Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Uncommitted changes found:"
    git status --short
    echo ""
    read -p "Commit changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M')"
        fi
        git add -A
        git commit -m "$COMMIT_MSG"
        print_status "Changes committed"
    fi
fi

# Step 2: Push to main
echo ""
echo "Step 2: Pushing to main branch..."
read -p "Push to main? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    print_status "Pushed to main"
fi

# Step 3: Deploy to production
echo ""
echo "Step 3: Deploying to production..."

ssh "$PRODUCTION_HOST" << 'SSHEOF'
set -e

echo "========================================="
echo "Production Deployment Started"
echo "========================================="

# Navigate to project
cd /var/www/pvpstrategygame || { echo "Project directory not found"; exit 1; }

echo "[1/5] Pulling latest changes..."
git pull origin main || { echo "Git pull failed"; exit 1; }

echo "[2/5] Installing dependencies..."
npm install || { echo "npm install failed"; exit 1; }

echo "[3/5] Ensuring Traefik CRDs are installed..."
# Create IngressRoute CRD if it doesn't exist
if ! kubectl get crd ingressroutes.traefik.containo.us >/dev/null 2>&1; then
    echo "Installing IngressRoute CRD..."
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
            properties:
              entryPoints:
                type: array
                items:
                  type: string
              routes:
                type: array
CRDEOF
    echo "IngressRoute CRD installed"
else
    echo "IngressRoute CRD already exists"
fi

echo "[4/5] Restarting PM2 services..."
# Restart backend
pm2 restart fortezza || { echo "PM2 restart failed"; exit 1; }

echo "[5/5] Waiting for service to be ready..."
sleep 5

# Check if PM2 is running
if pm2 list | grep -q "fortezza"; then
    echo "Fortezza is running:"
    pm2 list | grep fortezza
    echo ""
    echo "Deployment complete!"
else
    echo "Warning: fortezza not found in PM2 list"
fi

echo "========================================="
echo "Production Deployment Complete"
echo "========================================="
SSHEOF

print_status "Deployment script completed successfully!"
print_status "Check the logs with: ssh $PRODUCTION_HOST 'pm2 logs fortezza'"
