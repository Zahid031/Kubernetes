# Kubernetes Self-Healing Pods and Restart Policies

## Table of Contents
1. [What is Self-Healing?](#what-is-self-healing)
2. [Container Restart Policies](#container-restart-policies)
3. [Always Policy](#always-policy)
4. [OnFailure Policy](#onfailure-policy)
5. [Never Policy](#never-policy)
6. [Choosing the Right Policy](#choosing-the-right-policy)
7. [Real-World Examples](#real-world-examples)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## What is Self-Healing?

Self-healing is Kubernetes' ability to automatically detect and fix problems with your applications without human intervention. When containers fail, crash, or become unhealthy, Kubernetes can automatically restart them.

### How It Works:
```
Container Fails → Kubernetes Detects → Takes Action Based on Restart Policy
```

**Benefits:**
- 🔄 **Automatic Recovery**: No manual intervention needed
- ⚡ **Reduced Downtime**: Faster recovery from failures
- 🛡️ **Improved Reliability**: Applications stay available
- 😴 **Peace of Mind**: Less 3 AM wake-up calls!

## Container Restart Policies

Restart policies control **when** and **how** Kubernetes restarts your containers. There are three options:

| Policy | Restarts When | Best For |
|--------|---------------|----------|
| `Always` | Container stops (success or failure) | Web servers, APIs, long-running services |
| `OnFailure` | Container exits with error code | Batch jobs, data processing tasks |
| `Never` | Never restarts | One-time scripts, debugging |

## Always Policy

**Default behavior** - Containers restart regardless of how they exit.

### When to Use:
- Web servers (nginx, Apache)
- API services
- Database servers
- Any service that should always be running

### Example:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
spec:
  restartPolicy: Always  # This is the default
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
```

### What Happens:
```
Container exits with code 0 (success) → Restarts
Container exits with code 1 (error) → Restarts
Container killed by OOM → Restarts
Liveness probe fails → Restarts
```

### Deployment Example:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      restartPolicy: Always
      containers:
      - name: api
        image: myapi:v1.0
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## OnFailure Policy

**Restarts only when container fails** (exits with non-zero code).

### When to Use:
- Batch processing jobs
- Data migration scripts
- Backup operations
- Tasks that should complete successfully

### Example:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  restartPolicy: OnFailure
  containers:
  - name: processor
    image: data-processor:latest
    command: ["/bin/sh"]
    args: ["-c", "process-data.sh || exit 1"]
```

### What Happens:
```
Container exits with code 0 (success) → No restart
Container exits with code 1 (error) → Restarts
Container killed by OOM → Restarts
Liveness probe fails → Restarts
```

### Job Example:
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: backup-job
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: backup
        image: backup-tool:latest
        command: ["/backup.sh"]
        env:
        - name: BACKUP_TARGET
          value: "/data"
        volumeMounts:
        - name: data-volume
          mountPath: /data
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: app-data
  backoffLimit: 4  # Maximum retry attempts
```

## Never Policy

**Never restarts containers** regardless of exit status.

### When to Use:
- One-time initialization scripts
- Debug containers
- Testing and development
- Jobs that should only run once

### Example:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-script
spec:
  restartPolicy: Never
  containers:
  - name: initializer
    image: busybox
    command: ["/bin/sh"]
    args: ["-c", "echo 'Initialization complete' && sleep 10"]
```

### What Happens:
```
Container exits with code 0 (success) → No restart
Container exits with code 1 (error) → No restart
Container killed by OOM → No restart
Liveness probe fails → No restart
```

### Debug Example:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
spec:
  restartPolicy: Never
  containers:
  - name: debug
    image: busybox
    command: ["/bin/sh"]
    args: ["-c", "while true; do sleep 3600; done"]
    stdin: true
    tty: true
```

## Choosing the Right Policy

### Decision Tree:
```
Should your app always be running?
├── Yes → Always
└── No → Should it retry on failure?
    ├── Yes → OnFailure
    └── No → Never
```

### Examples by Use Case:

#### Web Applications
```yaml
restartPolicy: Always
# Web servers should always be available
```

#### Batch Jobs
```yaml
restartPolicy: OnFailure
# Retry failed jobs, but don't restart successful ones
```

#### One-time Scripts
```yaml
restartPolicy: Never
# Run once and stop
```

## Real-World Examples

### Example 1: E-commerce Website
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecommerce-web
spec:
  replicas: 5
  selector:
    matchLabels:
      app: ecommerce
  template:
    metadata:
      labels:
        app: ecommerce
    spec:
      restartPolicy: Always  # Must always be available
      containers:
      - name: web-app
        image: ecommerce:v2.1
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 10
          failureThreshold: 3
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Example 2: Daily Backup Job
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure  # Retry if backup fails
          containers:
          - name: backup
            image: backup-tool:latest
            command: ["/backup.sh"]
            env:
            - name: BACKUP_SOURCE
              value: "/data"
            - name: BACKUP_DEST
              value: "s3://my-backup-bucket"
            volumeMounts:
            - name: data
              mountPath: /data
              readOnly: true
          volumes:
          - name: data
            persistentVolumeClaim:
              claimName: app-data
          restartPolicy: OnFailure
```

### Example 3: Database Migration
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-migration
spec:
  restartPolicy: Never  # Run once, don't retry automatically
  containers:
  - name: migration
    image: migrate/migrate
    command: ["/migrate"]
    args: ["-path", "/migrations", "-database", "postgres://...", "up"]
    volumeMounts:
    - name: migrations
      mountPath: /migrations
  volumes:
  - name: migrations
    configMap:
      name: db-migrations
```

## Best Practices

### 1. Match Policy to Application Type

#### Long-Running Services
```yaml
# Web servers, APIs, databases
restartPolicy: Always
```

#### Batch Processing
```yaml
# ETL jobs, data processing
restartPolicy: OnFailure
```

#### One-Time Tasks
```yaml
# Migrations, initialization
restartPolicy: Never
```

### 2. Combine with Health Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resilient-app
spec:
  restartPolicy: Always
  containers:
  - name: app
    image: myapp:latest
    
    # Health probes work with restart policies
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 30
      failureThreshold: 3
    
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 10
      failureThreshold: 3
```

### 3. Resource Management

```yaml
containers:
- name: app
  image: myapp:latest
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"  # Prevent OOM kills
      cpu: "500m"
  # Restart policy works better with proper resource limits
```

### 4. Graceful Shutdowns

```yaml
spec:
  terminationGracePeriodSeconds: 30
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["/graceful-shutdown.sh"]
```

## Troubleshooting

### Restart Loop Issues

#### Problem: Pod in CrashLoopBackOff
```bash
# Check pod status
kubectl get pods

# See restart count and events
kubectl describe pod <pod-name>

# Check logs from previous container
kubectl logs <pod-name> --previous
```

#### Common Solutions:
```yaml
# Solution 1: Fix startup timing
livenessProbe:
  initialDelaySeconds: 60  # Give app time to start
  periodSeconds: 30

# Solution 2: Add startup probe
startupProbe:
  httpGet:
    path: /health
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
```

### Monitoring Restart Patterns

```bash
# Check restart counts
kubectl get pods -o custom-columns=NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount

# Watch pod status changes
kubectl get pods -w

# Get detailed restart history
kubectl describe pod <pod-name> | grep -A5 -B5 "Restart"
```

### Quick Debug Commands:
```bash
# Current pod status
kubectl get pod <pod-name> -o yaml | grep restartPolicy

# Pod events (shows restart reasons)
kubectl get events --field-selector involvedObject.name=<pod-name>

# Container logs (current and previous)
kubectl logs <pod-name> 
kubectl logs <pod-name> --previous

# Execute into running container
kubectl exec -it <pod-name> -- /bin/bash
```

## Summary

Self-healing pods are one of Kubernetes' most powerful features:

| Restart Policy | Use Case | Example |
|----------------|----------|---------|
| **Always** | Services that must always run | Web servers, APIs |
| **OnFailure** | Tasks that should retry on failure | Batch jobs, backups |
| **Never** | One-time tasks | Migrations, debug pods |

### Key Points:
- **Always** is the default and works for most applications
- **OnFailure** is perfect for jobs and batch processing
- **Never** is for special cases like debugging or one-time scripts
- Combine restart policies with health probes for maximum reliability

**Remember**: Kubernetes handles the complexity of failure detection and recovery, so you can focus on building great applications! 🎯

---

*Don't be the Same! Be Better!!!* 🚀💪