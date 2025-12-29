# Traefik API Gateway Setup in Kubernetes with Helm

This guide walks through setting up Traefik as an API Gateway in Kubernetes using the Gateway API and Helm.

## Prerequisites

- Kubernetes cluster up and running
- `kubectl` configured to access your cluster
- Helm 3.x installed

## Step 1: Install Gateway API CRDs

First, install the Kubernetes Gateway API Custom Resource Definitions (CRDs):

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
```

This installs the standard Gateway API resources including Gateway, HTTPRoute, and related CRDs.

## Step 2: Create Traefik Values Configuration

Create a `traefik-values.yaml` file with the following configuration:

```yaml
deployment:
  enabled: true

ports:
  web:
    port: 8000
    expose:
      default: true
  websecure:
    port: 8443
    expose:
      default: true

providers:
  kubernetesGateway:
    enabled: true
api:
  dashboard: true
  insecure: true

gateway:
  enabled: false

```

**Configuration breakdown:**
- `deployment.enabled: true` - Enables Traefik deployment
- `ports.web.port: 8000` - HTTP traffic port
- `ports.websecure.port: 8443` - HTTPS traffic port
- `providers.kubernetesGateway.enabled: true` - Enables Gateway API provider
- `gateway.enabled: false` - Disables Traefik's built-in Gateway resource (we'll create our own)

## Step 3: Install Traefik with Helm

Add the Traefik Helm repository and install:

```bash
# Add Traefik Helm repository
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Install Traefik
helm install traefik traefik/traefik \
  -f traefik-values.yaml \
  -n traefik \
  --create-namespace
```

## Step 4: Create Gateway Resource

Create a `traefik-gateway.yaml` file to define your Gateway:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: traefik-gateway
  namespace: traefik
spec:
  gatewayClassName: traefik
  listeners:
    - name: http
      protocol: HTTP
      port: 8000      # Must match Traefik pod port
      allowedRoutes:
        namespaces:
          from: All
    - name: https
      protocol: HTTPS
      port: 8443      # Must match Traefik pod port
      allowedRoutes:
        namespaces:
          from: All
      tls:
        mode: Terminate
        certificateRefs:
          - name: my-certificate   # Pre-created TLS secret
```

Apply the Gateway resource:

```bash
kubectl apply -f traefik-gateway.yaml
```

## Step 5: Create TLS Certificate (Optional)

If you're using HTTPS, create a TLS secret:

```bash
kubectl create secret tls my-certificate \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n traefik
```

Or use cert-manager for automated certificate management.

## Step 6: Verify Installation

Check that Traefik is running:

```bash
# Check pods
kubectl get pods -n traefik

# Check Gateway status
kubectl get gateway -n traefik

# Describe Gateway for detailed status
kubectl describe gateway traefik-gateway -n traefik
```

## Step 7: Create an HTTPRoute Example

Create a sample application and HTTPRoute to test:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
  namespace: default
spec:
  parentRefs:
    - name: traefik-gateway
      namespace: traefik
  hostnames:
    - "example.local"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: example-service
          port: 80
```

Apply the route:

```bash
kubectl apply -f example-route.yaml
```

## Accessing the Gateway

Get the Traefik service:

```bash
kubectl get svc -n traefik
```

Access your applications through:
- HTTP: `http://<EXTERNAL-IP>:8000`
- HTTPS: `https://<EXTERNAL-IP>:8443`

## Troubleshooting

### Check Traefik logs
```bash
kubectl logs -n traefik -l app.kubernetes.io/name=traefik
```

### Verify Gateway API resources
```bash
kubectl api-resources | grep gateway
```

### Check Gateway status
```bash
kubectl get gateway traefik-gateway -n traefik -o yaml
```

## Additional Configuration

### Enable Dashboard

Add to `traefik-values.yaml`:

```yaml
ingressRoute:
  dashboard:
    enabled: true
```

### Add Metrics

```yaml
metrics:
  prometheus:
    enabled: true
```

### Configure Resource Limits

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "300m"
    memory: "256Mi"
```

## Cleanup

To remove the installation:

```bash
# Delete Gateway
kubectl delete -f traefik-gateway.yaml

# Uninstall Traefik
helm uninstall traefik -n traefik

# Delete namespace
kubectl delete namespace traefik

# Remove Gateway API CRDs (optional)
kubectl delete -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml
```

## References

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Gateway API Documentation](https://gateway-api.sigs.k8s.io/)
- [Traefik Helm Chart](https://github.com/traefik/traefik-helm-chart)
