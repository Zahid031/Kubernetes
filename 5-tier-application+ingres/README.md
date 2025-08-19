# Todo Application with NGINX Ingress

This repository contains Kubernetes manifests for deploying a Todo application with NGINX Ingress path-based routing in the `todo-ingress` namespace.

## Architecture

```
                    ┌─────────────────┐
                    │   NGINX Ingress │
                    │  todo-app.local │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
    │    Frontend     │ │ User Service│ │Task Service │
    │     (React)     │ │   (Django)  │ │    (Go)     │
    │    Port: 80     │ │  Port: 8000 │ │ Port: 8001  │
    └─────────────────┘ └─────────────┘ └─────────────┘
                              │               │
                              └───────┬───────┘
                                      │
                    ┌─────────────────┼───────────────┐
                    ▼                 ▼               ▼
              ┌───────────┐   ┌─────────────┐  ┌──────────────┐
              │PostgreSQL │   │  RabbitMQ   │  │    Volume    │
              │  Port:5432│   │Port:5672/   │  │   Storage    │
              │           │   │    15672    │  │              │
              └───────────┘   └─────────────┘  └──────────────┘
```

## File Structure

```
kubernetes/
├── 00-namespace.yaml          # Namespace definition
├── 01-secrets.yaml           # Database and RabbitMQ secrets
├── 02-configmaps.yaml        # Application and RabbitMQ configuration
├── 03-postgres.yaml          # PostgreSQL StatefulSet and Service
├── 04-rabbitmq.yaml          # RabbitMQ Deployment, Service, and PVC
├── 05-user-service.yaml      # User Service Deployment and Service
├── 06-task-service.yaml      # Task Service Deployment and Service
├── 07-frontend.yaml          # Frontend Deployment and Service
├── 08-ingress.yaml           # NGINX Ingress configuration
├── 09-ingress-ssl.yaml       # SSL/TLS enabled Ingress (optional)
└── deploy.sh                 # Automated deployment script
```

## Quick Start

### 1. Prerequisites

Ensure you have:
- Kubernetes cluster running
- `kubectl` configured
- NGINX Ingress Controller installed

### 2. Deploy Everything

```bash
# Make the script executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

### 3. Manual Deployment (Alternative)

```bash
# Deploy in order
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets.yaml
kubectl apply -f 02-configmaps.yaml
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-rabbitmq.yaml

# Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=postgres -n todo-ingress --timeout=300s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n todo-ingress --timeout=300s

# Deploy services
kubectl apply -f 05-user-service.yaml
kubectl apply -f 06-tasks-service.yaml
kubectl apply -f 07-frontend.yaml

# Wait for services
kubectl wait --for=condition=ready pod -l app=user-service -n todo-ingress --timeout=300s
kubectl wait --for=condition=ready pod -l app=task-service -n todo-ingress --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n todo-ingress --timeout=300s

# Deploy ingress
kubectl apply -f 08-ingress.yaml
```

## DNS Configuration

### For Local Development

Add to your `/etc/hosts` file:
```
<INGRESS_CONTROLLER_IP> todo-app.local
```

Find the ingress IP:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

### For Production

Configure DNS A record:
```
todo-app.yourdomain.com → <INGRESS_CONTROLLER_IP>
```

## Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://todo-app.local | Main React application |
| User API | http://todo-app.local/api/users | User management endpoints |
| Task API | http://todo-app.local/api/tasks | Task management endpoints |
| RabbitMQ | http://todo-app.local/rabbitmq | Management interface (admin/admin123) |

## API Endpoints

### User Service (`/api/users`)
- `GET /api/users/` - List users
- `POST /api/users/` - Create user
- `GET /api/users/{id}/` - Get user details
- `PUT /api/users/{id}/` - Update user
- `DELETE /api/users/{id}/` - Delete user

### Task Service (`/api/tasks`)
- `GET /api/tasks/` - List tasks
- `POST /api/tasks/` - Create task
- `GET /api/tasks/{id}/` - Get task details
- `PUT /api/tasks/{id}/` - Update task
- `DELETE /api/tasks/{id}/` - Delete task

## Testing

### Health Checks
```bash
# Test frontend
curl -H "Host: todo-app.local" http://<INGRESS_IP>/

# Test user service
curl -H "Host: todo-app.local" http://<INGRESS_IP>/api/users/

# Test task service
curl -H "Host: todo-app.local" http://<INGRESS_IP>/api/tasks/
```

### Browser Testing
1. Add DNS entry to `/etc/hosts`
2. Navigate to http://todo-app.local
3. The React frontend should load and make API calls to the backend services

## SSL/TLS Setup (Production)

### Option 1: cert-manager (Recommended)

1. Install cert-manager:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

2. Create ClusterIssuer:
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

3. Use `09-ingress-ssl.yaml` instead of `08-ingress.yaml`

### Option 2: Manual Certificate

```bash
# Generate self-signed certificate (development only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout tls.key -out tls.crt -subj "/CN=todo-app.local"

# Create secret
kubectl create secret tls todo-app-tls-secret \
    --cert=tls.crt --key=tls.key -n todo-ingress
```

## Monitoring and Troubleshooting

### View Logs
```bash
# Application logs
kubectl logs -f deployment/user-service -n todo-ingress
kubectl logs -f deployment/task-service -n todo-ingress
kubectl logs -f deployment/frontend -n todo-ingress

# Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f
```

### Check Status
```bash
# Pod status
kubectl get pods -n todo-ingress -o wide

# Service status
kubectl get svc -n todo-ingress

# Ingress status
kubectl get ingress -n todo-ingress
kubectl describe ingress todo-app-ingress -n todo-ingress
```

### Common Issues

1. **503 Service Unavailable**
   - Check if pods are running and ready
   - Verify service selectors match pod labels
   - Check readiness probes

2. **DNS Resolution**
   - Verify `/etc/hosts` entry
   - Check ingress controller IP
   - Try accessing via IP with Host header

3. **CORS Errors**
   - Verify CORS annotations in ingress
   - Check backend CORS configuration
   - Ensure allowed origins include ingress domain

## Scaling

### Horizontal Scaling
```bash
# Scale services
kubectl scale deployment user-service --replicas=3 -n todo-ingress
kubectl scale deployment task-service --replicas=3 -n todo-ingress
kubectl scale deployment frontend --replicas=2 -n todo-ingress
```

### Resource Limits
Update resource requests/limits in deployment files:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

## Cleanup

```bash
# Delete everything
kubectl delete namespace todo-ingress

# Or delete individual components
kubectl delete -f 08-ingress.yaml
kubectl delete -f 07-frontend.yaml
kubectl delete -f 06-task-service.yaml
kubectl delete -f 05-user-service.yaml
kubectl delete -f 04-rabbitmq.yaml
kubectl delete -f 03-postgres.yaml
kubectl delete -f 02-configmaps.yaml
kubectl delete -f 01-secrets.yaml
kubectl delete -f 00-namespace.yaml
```

## Environment Variables

The application uses the following environment variables:

### Frontend
- `VITE_API_USERS`: User service API URL
- `VITE_API_TASKS`: Task service API URL

### Backend Services
- `DATABASE_URL`: PostgreSQL connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `ALLOWED_HOSTS`: Django allowed hosts
- `CORS_ALLOWED_ORIGINS`: CORS configuration

## Security Notes

- Change default passwords in production
- Use proper SSL certificates
- Configure network policies for additional security
- Enable authentication and authorization
- Regular security updates for container images
- Use least privilege access principles