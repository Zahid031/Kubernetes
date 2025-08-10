# Kubernetes Application Scaling and Deployments Guide

## Table of Contents
1. [Application Scaling Overview](#application-scaling-overview)
2. [Stateless vs Stateful Applications](#stateless-vs-stateful-applications)
3. [ReplicationController](#replicationcontroller)
4. [ReplicaSet](#replicaset)
5. [Deployments](#deployments)
6. [Practical Commands](#practical-commands)
7. [Best Practices](#best-practices)

## Application Scaling Overview

**Application scaling** is the ability of an application to handle increasing workload by adding resources. In Kubernetes, you can scale applications by managing the number of Pods running your application.

### Types of Scaling
- **Horizontal Scaling**: Adding more Pod replicas
- **Vertical Scaling**: Increasing CPU/memory resources per Pod

## Stateless vs Stateful Applications

### Stateless Applications
- Do not store client data between sessions
- Each request is independent
- Can be scaled horizontally by adding more Pod replicas
- Examples: Web servers, API services, microservices

### Stateful Applications
- Store client data and maintain state between sessions
- Require persistent storage and consistent identity
- Typically scaled vertically (more resources per Pod)
- Examples: Databases, message queues

## ReplicationController

ReplicationController ensures a specified number of Pod replicas are running at all times. It's the basic scaling mechanism in Kubernetes.

### Key Features
- Maintains desired number of replica Pods
- Replaces failed Pods automatically
- Uses equality-based label selectors

### Example Configuration
```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: alpine-box-replicationcontroller
spec:
  replicas: 3
  selector:
    app: alpine-box
  template:
    metadata:
      name: alpine
      labels:
        app: alpine-box
    spec:
      containers:
      - name: alpine-box
        image: alpine
        command: ["sleep", "3600"]
```

## ReplicaSet

ReplicaSet is the enhanced version of ReplicationController with more flexible label selector support.

### Key Improvements
- Supports set-based label selectors
- Uses operators like `In`, `NotIn`, and `Exists`
- Better integration with Deployments

### Label Selector Types
```yaml
# Equality-based (ReplicationController style)
selector:
  app: myapp
  tier: frontend

# Set-based (ReplicaSet style)
selector:
  matchExpressions:
    - {key: tier, operator: In, values: [frontend]}
    - {key: environment, operator: NotIn, values: [production]}
```

### Example Configuration
```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: myapp-replicas
  labels:
    app: myapp
    tier: frontend
spec:
  replicas: 3
  selector:
    matchExpressions:
      - {key: tier, operator: In, values: [frontend]}
  template:
    metadata:
      labels:
        app: myapp
        tier: frontend
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
```

### ReplicaSet vs Bare Pods
- Bare Pods without matching labels won't be managed by ReplicaSet
- ReplicaSet can adopt existing Pods with matching labels
- Always use controllers (ReplicaSet/Deployment) instead of bare Pods in production

## Deployments

Deployment is the highest-level controller that manages ReplicaSets and provides declarative updates to applications.

### Deployment Hierarchy
```
Deployment
  └── ReplicaSet
      └── Pods
          └── Containers
```

### Key Features
- **Declarative Updates**: Define desired state, Kubernetes handles the transition
- **Rolling Updates**: Zero-downtime deployments
- **Rollback Capability**: Revert to previous versions
- **Scaling**: Easy horizontal scaling
- **Pause/Resume**: Control rollout process

### Use Cases
1. **Deploy Applications**: Create and manage application Pods
2. **Update Applications**: Roll out new versions safely
3. **Scale Applications**: Adjust replica count based on demand
4. **Rollback**: Revert to previous stable versions
5. **Pause/Resume**: Control deployment rollouts

### Example Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-lite
  labels:
    app: test-lite
spec:
  replicas: 2
  selector:
    matchLabels:
      app: test-lite
  template:
    metadata:
      labels:
        app: test-lite
    spec:
      containers:
        - name: busybox-container
          image: busybox:latest
          command: ["sh", "-c", "echo Hello from BusyBox; sleep 3600"]
        - name: alpine-container
          image: alpine:latest
          command: ["sh", "-c", "echo Hello from Alpine; sleep 3600"]
```

## Practical Commands

### Deployment Management

#### Create Deployment
```bash
# From YAML file
kubectl apply -f deployment.yml

# Imperatively
kubectl create deployment nginx-deployment --image=nginx --replicas=3
```

#### Scale Deployment
```bash
# Scale to specific number of replicas
kubectl scale deployment test-lite --replicas=5

# Auto-scale based on CPU usage
kubectl autoscale deployment test-lite --cpu-percent=50 --min=1 --max=10
```

#### Update Deployment
```bash
# Update image
kubectl set image deployment/test-lite busybox-container=busybox:1.35

# Edit deployment directly
kubectl edit deployment test-lite

# Update from file
kubectl apply -f deployment.yml
```

#### Rollout Management
```bash
# Check rollout status
kubectl rollout status deployment/test-lite

# View rollout history
kubectl rollout history deployment/test-lite

# Rollback to previous version
kubectl rollout undo deployment/test-lite

# Rollback to specific revision
kubectl rollout undo deployment/test-lite --to-revision=2

# Pause rollout
kubectl rollout pause deployment/test-lite

# Resume rollout
kubectl rollout resume deployment/test-lite
```

### ReplicaSet Management

```bash
# List ReplicaSets
kubectl get replicaset

# Scale ReplicaSet
kubectl scale replicaset myapp-replicas --replicas=5

# Delete ReplicaSet
kubectl delete replicaset myapp-replicas
```

### ReplicationController Management

```bash
# List ReplicationControllers
kubectl get replicationcontroller

# Scale ReplicationController
kubectl scale replicationcontroller alpine-box-replicationcontroller --replicas=5

# Delete ReplicationController
kubectl delete replicationcontroller alpine-box-replicationcontroller
```

### Monitoring and Debugging

```bash
# Get deployment details
kubectl describe deployment test-lite

# View deployment events
kubectl get events --sort-by=.metadata.creationTimestamp

# Check Pod logs
kubectl logs -f deployment/test-lite

# Get deployment YAML
kubectl get deployment test-lite -o yaml
```

## Best Practices

### 1. Use Deployments Over ReplicaSets
- Deployments provide additional features like rolling updates and rollbacks
- Always prefer Deployments for stateless applications

### 2. Set Resource Requests and Limits
```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### 3. Use Readiness and Liveness Probes
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5

livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
```

### 4. Configure Rolling Update Strategy
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 1
```

### 5. Use Labels and Selectors Consistently
- Use meaningful labels for organization
- Ensure selector labels match template labels
- Use namespaces for isolation

### 6. Monitor Resource Usage
- Use metrics server for resource monitoring
- Set up horizontal Pod autoscaler for dynamic scaling
- Monitor application performance and adjust replica counts accordingly

## Summary

- **ReplicationController**: Basic Pod replication with equality-based selectors
- **ReplicaSet**: Enhanced version with set-based selectors
- **Deployment**: Highest-level controller with rolling updates and rollback capabilities

For production workloads, always use Deployments as they provide the most comprehensive set of features for managing application lifecycle, scaling, and updates in Kubernetes.