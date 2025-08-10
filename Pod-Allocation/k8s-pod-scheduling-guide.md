# Kubernetes Pod Scheduling & Allocation Guide

## What is Pod Scheduling?

Pod scheduling is the process of assigning Pods to specific Nodes in a Kubernetes cluster so that the kubelet can run them. Think of it like a smart placement system that decides which server (Node) should run your application (Pod).

**Key Components:**
- **Scheduler**: A component on the Master Node that makes scheduling decisions
- **kubelet**: The agent on each Node that actually runs the Pods
- **Nodes**: Worker machines where Pods are placed

## How Scheduling Works

The Kubernetes Scheduler considers several factors when placing Pods:

1. **Resource Requirements**: Does the Node have enough CPU/memory?
2. **Node Labels**: Metadata attached to Nodes for identification
3. **Scheduling Constraints**: Rules defined by users (nodeSelector, affinity, etc.)
4. **Taints and Tolerations**: Node restrictions and Pod permissions

## Methods of Pod Allocation

### 1. Automatic Scheduling (Default)

When you create a Pod without specific placement rules, the scheduler automatically selects the best Node based on available resources.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
    - name: app
      image: nginx
# No scheduling constraints - scheduler decides
```

### 2. nodeSelector

The simplest way to constrain Pod placement using Node labels.

**How it works:**
- Add labels to Nodes: `kubectl label nodes node1 disktype=ssd`
- Use nodeSelector in Pod spec to match labels

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-nodeselector
spec:
  containers:
    - name: nginx
      image: nginx
  nodeSelector:
    disktype: ssd  # Only schedule on nodes with this label
```

**Use Cases:**
- Run database Pods on high-performance storage nodes
- Place GPU workloads on GPU-enabled nodes
- Separate production from development workloads

### 3. nodeName

Directly assign a Pod to a specific Node by name, bypassing the scheduler entirely.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-nodename
spec:
  containers:
    - name: nginx
      image: nginx
  nodeName: k8s-worker-01  # Force placement on this specific node
```

**Limitations:**
- No resource checking
- Node must exist and be ready
- Not recommended for production use
- No automatic rescheduling if node fails

### 4. Node Affinity

An enhanced and more flexible version of nodeSelector with additional operators and conditions.

#### Types of Node Affinity

**Hard Affinity (Required):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-nodeaffinity
spec:
  containers:
    - name: nginx
      image: nginx
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: disktype
                operator: In
                values:
                  - ssd
```

**Soft Affinity (Preferred):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-preferred
spec:
  containers:
    - name: nginx
      image: nginx
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - key: zone
                operator: In
                values:
                  - us-west-1
```

#### Available Operators
- `In`: Value must be in the list
- `NotIn`: Value must not be in the list
- `Exists`: Key must exist (value ignored)
- `DoesNotExist`: Key must not exist
- `Gt`: Greater than (numeric values)
- `Lt`: Less than (numeric values)

#### Node Anti-Affinity

Prevent Pods from being scheduled on certain nodes:

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: disktype
              operator: NotIn  # Avoid nodes with SSD
              values:
                - ssd
```

### 5. Pod Affinity and Anti-Affinity

Control Pod placement based on other Pods already running on nodes.

**Pod Affinity** (schedule near other Pods):
```yaml
affinity:
  podAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app
              operator: In
              values:
                - database
        topologyKey: kubernetes.io/hostname
```

**Pod Anti-Affinity** (avoid scheduling near other Pods):
```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app
              operator: In
              values:
                - web-server
        topologyKey: kubernetes.io/hostname
```

### 6. Taints and Tolerations

**Taints** are applied to Nodes to repel Pods, while **Tolerations** are applied to Pods to allow scheduling on tainted Nodes.

**Add a taint to a Node:**
```bash
kubectl taint nodes node1 key=value:NoSchedule
```

**Add toleration to Pod:**
```yaml
spec:
  tolerations:
    - key: "key"
      operator: "Equal"
      value: "value"
      effect: "NoSchedule"
```

**Taint Effects:**
- `NoSchedule`: Don't schedule new Pods
- `PreferNoSchedule`: Try to avoid scheduling
- `NoExecute`: Evict existing Pods

## Special Pod Types

### DaemonSets

Automatically run one copy of a Pod on each Node (or selected Nodes).

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: logging
spec:
  selector:
    matchLabels:
      app: httpd-logging
  template:
    metadata:
      labels:
        app: httpd-logging
    spec:
      containers:
        - name: webserver
          image: httpd
```

**Common Use Cases:**
- Log collection (Fluentd, Filebeat)
- Monitoring agents (Prometheus Node Exporter)
- Network proxies (kube-proxy)
- Storage daemons

### Static Pods

Managed directly by kubelet on individual Nodes, not by the API server.

**Characteristics:**
- Defined by YAML files in kubelet's manifest directory
- Automatically restarted by kubelet if they fail
- Cannot be managed via kubectl (read-only mirror pods appear in API)
- Useful for critical system components

**Configuration:**
1. Place YAML file in kubelet manifest directory (usually `/etc/kubernetes/manifests/`)
2. kubelet automatically creates and manages the Pod

## Resource Requests and Limits

Influence scheduling decisions by specifying resource requirements:

```yaml
spec:
  containers:
    - name: app
      image: alpine
      resources:
        requests:
          memory: "64Mi"
          cpu: "250m"
        limits:
          memory: "128Mi"
          cpu: "500m"
```

**Requests vs Limits:**
- **Requests**: Minimum resources guaranteed (used for scheduling)
- **Limits**: Maximum resources allowed (prevents resource hogging)

## Best Practices

### 1. Use Resource Requests
Always specify resource requests to help the scheduler make informed decisions.

### 2. Prefer Affinity over nodeSelector
Node affinity provides more flexibility and better error handling.

### 3. Combine Multiple Constraints
Use multiple scheduling constraints together for fine-grained control.

### 4. Label Nodes Appropriately
Create meaningful labels for your Nodes:
```bash
kubectl label nodes worker-1 zone=us-west-1
kubectl label nodes worker-1 instance-type=compute-optimized
kubectl label nodes worker-1 storage=ssd
```

### 5. Test Scheduling Behavior
Use `kubectl describe pod` to see why Pods might not be scheduling:
```bash
kubectl describe pod my-pod
# Look for events and scheduling information
```

### 6. Monitor Node Resources
Keep track of Node capacity and usage:
```bash
kubectl top nodes
kubectl describe node worker-1
```

## Common Scheduling Scenarios

### High Availability Setup
```yaml
# Spread replicas across different nodes
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: web-app
        topologyKey: kubernetes.io/hostname
```

### Database with Fast Storage
```yaml
# Ensure database runs on SSD nodes
nodeSelector:
  storage: ssd
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
```

### Batch Jobs in Specific Zones
```yaml
# Run batch processing in cost-effective zones
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: zone
              operator: In
              values:
                - us-west-2  # Cheaper zone
```

## Troubleshooting Scheduling Issues

### Common Problems
1. **Pod stuck in Pending state**: Check resource requests vs Node capacity
2. **No suitable Nodes**: Verify Node labels and scheduling constraints
3. **Taints preventing scheduling**: Add appropriate tolerations

### Debugging Commands
```bash
# Check Pod status and events
kubectl describe pod <pod-name>

# Check Node resources and taints
kubectl describe node <node-name>

# View scheduler logs
kubectl logs -n kube-system <scheduler-pod-name>

# Check resource usage
kubectl top nodes
kubectl top pods
```

## Summary

Kubernetes Pod scheduling provides multiple mechanisms for controlling where your applications run:

- **Automatic**: Let the scheduler decide (recommended for most cases)
- **nodeSelector**: Simple label-based node selection
- **Node Affinity**: Advanced node selection with multiple operators
- **Pod Affinity/Anti-Affinity**: Schedule based on other Pods' locations
- **Taints/Tolerations**: Node-level restrictions and exceptions
- **DaemonSets**: Run on all (or selected) nodes
- **Static Pods**: Direct kubelet management

Choose the appropriate method based on your application's requirements, and always consider resource requests, high availability, and operational complexity when making scheduling decisions.