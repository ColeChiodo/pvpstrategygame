#!/bin/bash
# Apply K8s CRDs and configs on production

# Create IngressRoute CRD if it doesn't exist
kubectl get crd ingressroutes.traefik.containo.us >/dev/null 2>&1 || \
kubectl apply -f - <<'EOF'
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
EOF

# Apply K8s configs
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/traefik-rbac.yaml

echo "Done! Check with: kubectl get crd | grep traefik"
