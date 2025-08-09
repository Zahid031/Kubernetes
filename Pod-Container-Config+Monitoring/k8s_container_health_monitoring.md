# Kubernetes Container Health Monitoring

## Table of Contents
1. [Overview](#overview)
2. [Why Health Monitoring?](#why-health-monitoring)
3. [Types of Health Probes](#types-of-health-probes)
4. [Liveness Probe](#liveness-probe)
5. [Startup Probe](#startup-probe)
6. [Readiness Probe](#readiness-probe)
7. [Probe Configuration](#probe-configuration)
8. [Practical Examples](#practical-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

Kubernetes provides built-in health monitoring for containers through **health probes**. These probes help Kubernetes make smart decisions about when to restart containers, route traffic, and handle failures automatically.

## Why Health Monitoring?

Without health probes, Kubernetes only knows if a container process is running. But what if:
- Your app is stuck in an infinite loop? 🔄
- Database connections are hanging? 🔌
- The app is starting but not ready for traffic? ⏳

Health probes solve these problems by letting you define custom health checks.

## Types of Health Probes

| Probe | Purpose | What happens on failure? |
|-------|---------|-------------------------|
| **Liveness** | "Is my app running properly?" | Container gets restarted |
| **Readiness** | "Is my app ready for traffic?" | Removed from service |
| **Startup** | "Has my app finished starting?" | Container gets restarted |

## Liveness Probe

**Purpose**: Detects when your application is stuck or unhealthy and needs a restart.

### Three Ways to Check Liveness:

#### 1. Command Execution
```yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy
  initialDelaySeconds: 5
  periodSeconds: 10
```

#### 2. HTTP Request
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
```

#### 3. TCP Socket
```yaml
livenessProbe:
  tcpSocket:
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
```

### Complete Example:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: webapp-with-liveness
spec:
  containers:
  - name: webapp
    image: nginx
    ports:
    - containerPort: 80
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3
```

## Startup Probe

**Purpose**: Gives slow-starting applications time to initialize before liveness checks begin.

**Problem**: Some apps (like Java applications) take a long time to start. Without startup probes, liveness probes might kill them before they're ready.

**Solution**: Startup probe runs first, then hands over to liveness probe.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: slow-starting-app
spec:
  containers:
  - name: app
    image: java-spring-app
    startupProbe:
      httpGet:
        path: /health
        port: 8080
      failureThreshold: 30    # 30 attempts
      periodSeconds: 10       # Every 10 seconds
      # Total startup time: 30 × 10 = 300 seconds (5 minutes)
    
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 10
      failureThreshold: 3
```

## Readiness Probe

**Purpose**: Controls when a pod should receive traffic from services.

**Use Cases**:
- App is loading configuration files
- Waiting for database connections
- Performing data migrations

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: webapp-with-readiness
spec:
  containers:
  - name: webapp
    image: myapp
    ports:
    - containerPort: 8080
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
```

## Probe Configuration

### Key Parameters:
- **`initialDelaySeconds`**: Wait time before first probe (default: 0)
- **`periodSeconds`**: How often to probe (default: 10)
- **`timeoutSeconds`**: Max wait for response (default: 1)
- **`failureThreshold`**: Failures before giving up (default: 3)
- **`successThreshold`**: Successes to be considered healthy (default: 1)

### Timing Examples:
```yaml
# Quick response app
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 2

# Slow response app  
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 15
  timeoutSeconds: 10
```

## Practical Examples

### Example 1: Web Application with All Probes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web-app
        image: mywebapp:latest
        ports:
        - containerPort: 8080
        
        # For slow-starting apps
        startupProbe:
          httpGet:
            path: /startup
            port: 8080
          failureThreshold: 30
          periodSeconds: 10
        
        # Detect app crashes/hangs
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Control traffic flow
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
```

### Example 2: Database with Startup Dependencies
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: postgres-with-probes
spec:
  containers:
  - name: postgres
    image: postgres:13
    env:
    - name: POSTGRES_DB
      value: myapp
    - name: POSTGRES_USER
      value: admin
    - name: POSTGRES_PASSWORD
      value: password
    
    startupProbe:
      exec:
        command:
        - pg_isready
        - -U
        - admin
        - -d
        - myapp
      failureThreshold: 30
      periodSeconds: 10
    
    livenessProbe:
      exec:
        command:
        - pg_isready
        - -U
        - admin
      periodSeconds: 60
      timeoutSeconds: 10
    
    readinessProbe:
      exec:
        command:
        - pg_isready
        - -U
        - admin
        - -d
        - myapp
      periodSeconds: 10
      timeoutSeconds: 5
```

## Best Practices

### ✅ Do's
- **Keep probes lightweight**: Quick checks, not heavy operations
- **Use different endpoints**: `/health`, `/ready`, `/startup`
- **Set realistic timeouts**: Consider network latency
- **Test your probes**: Verify they work as expected

### ❌ Don'ts
- **Don't use expensive operations**: Database queries, file I/O
- **Don't make external calls**: Probe should check the app itself
- **Don't set timeouts too short**: Avoid false positives
- **Don't ignore probe failures**: Monitor and alert on failures

### Recommended Settings:

#### Fast Applications (like nginx)
```yaml
livenessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

#### Slow Applications (like Java/Spring)
```yaml
startupProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  failureThreshold: 60
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3
```

## Troubleshooting

### Common Issues:

#### 1. Pod Keeps Restarting
```bash
# Check events
kubectl describe pod <pod-name>

# Look for probe failures
kubectl get events --sort-by=.metadata.creationTimestamp
```

**Solution**: Increase `initialDelaySeconds` or `failureThreshold`

#### 2. Pod Not Receiving Traffic
```bash
# Check readiness status
kubectl get pods
kubectl describe pod <pod-name>

# Check service endpoints
kubectl get endpoints <service-name>
```

**Solution**: Fix readiness probe or application issue

#### 3. Probe Timeouts
```bash
# Test probe manually
kubectl exec <pod-name> -- curl http://localhost:8080/health

# Check application logs
kubectl logs <pod-name>
```

**Solution**: Increase `timeoutSeconds` or optimize health endpoint

### Useful Debug Commands:
```bash
# View pod status
kubectl get pods -o wide

# Describe pod for events
kubectl describe pod <pod-name>

# Check application logs
kubectl logs <pod-name> -f

# Execute commands inside pod
kubectl exec <pod-name> -- <command>

# Port forward for testing
kubectl port-forward pod/<pod-name> 8080:8080
```

### Quick Health Check Test:
```bash
# Create a simple test pod
kubectl run test-pod --image=nginx --restart=Never --rm -it -- /bin/bash

# Inside pod, test your health endpoint
curl http://your-service:8080/health
```

## Summary

Health probes are your insurance policy for reliable applications:

1. **Liveness Probe**: Restarts unhealthy containers
2. **Readiness Probe**: Controls traffic flow to ready containers  
3. **Startup Probe**: Protects slow-starting applications

**Key Takeaway**: Start simple, monitor failures, and adjust settings based on your application's behavior.

**Remember**: A well-configured health check system prevents outages and ensures your users always get a working application! 🎯

---

*Don't be the Same! Be Better!!!* 🚀