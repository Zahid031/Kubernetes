# Todo Application with Kubernetes & NGINX Ingress

A microservices-based Todo application deployed on Kubernetes with NGINX Ingress path-based routing.

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

## Prerequisites

- Kubernetes cluster
- kubectl configured
- Helm installed
- NFS subdir external provisioner (for persistent storage)

## Quick Start

### 1. Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30080 \
  --set controller.service.nodePorts.https=30443
```

### 2. Deploy the Application

```bash
# Deploy infrastructure
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets.yaml
kubectl apply -f 02-configmaps.yaml
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-rabbitmq.yaml

# Wait for database and message queue
kubectl wait --for=condition=ready pod -l app=postgres -n todo-ingress --timeout=100s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n todo-ingress --timeout=100s

# Deploy services
kubectl apply -f 05-user-service.yaml
kubectl apply -f 06-task-service.yaml
kubectl apply -f 07-frontend.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=user-service -n todo-ingress --timeout=100s
kubectl wait --for=condition=ready pod -l app=task-service -n todo-ingress --timeout=100s
kubectl wait --for=condition=ready pod -l app=frontend -n todo-ingress --timeout=100s

# Deploy ingress
kubectl apply -f 08-ingress.yaml
```

### 3. Configure DNS

Add to your `/etc/hosts` file:
```
<INGRESS_CONTROLLER_IP> todo-app.local
```

Get the ingress IP:
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

## Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://todo-app.local | Main application |
| User API | http://todo-app.local/api/users | User management |
| Task API | http://todo-app.local/api/tasks | Task management |
| RabbitMQ UI | http://todo-app.local/rabbitmq | Queue management (admin/admin123) |

## File Structure

```
kubernetes/
├── 00-namespace.yaml      # Namespace
├── 01-secrets.yaml       # Database & RabbitMQ secrets
├── 02-configmaps.yaml    # Application configuration
├── 03-postgres.yaml      # PostgreSQL database
├── 04-rabbitmq.yaml      # RabbitMQ message queue
├── 05-user-service.yaml  # User service (Django)
├── 06-task-service.yaml  # Task service (Go)
├── 07-frontend.yaml      # Frontend (React)
└── 08-ingress.yaml       # NGINX Ingress rules
```

## Troubleshooting

### Check Application Status
```bash
# View pods
kubectl get pods -n todo-ingress

# View services
kubectl get svc -n todo-ingress

# View ingress
kubectl get ingress -n todo-ingress
```

### View Logs
```bash
# Application logs
kubectl logs -f deployment/user-service -n todo-ingress
kubectl logs -f deployment/task-service -n todo-ingress
kubectl logs -f deployment/frontend -n todo-ingress

# Ingress logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f
```

### Common Issues

- **503 Service Unavailable**: Check if pods are running and ready
- **DNS Issues**: Verify `/etc/hosts` entry and ingress IP
- **CORS Errors**: Check ingress CORS annotations

## Scaling

Scale services as needed:
```bash
kubectl scale deployment user-service --replicas=3 -n todo-ingress
kubectl scale deployment task-service --replicas=3 -n todo-ingress
kubectl scale deployment frontend --replicas=2 -n todo-ingress
```

## Cleanup

Remove all resources:
```bash
kubectl delete namespace todo-ingress
```

## Security Notes

For production deployment:
- Change default passwords in secrets
- Use SSL certificates (Let's Encrypt)
- Configure network policies
- Enable proper authentication
- Update container images regularly
