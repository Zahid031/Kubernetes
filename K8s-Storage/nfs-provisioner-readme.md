# Complete NFS Subdir External Provisioner Setup Guide

This comprehensive guide covers everything from setting up an NFS server on a separate machine to configuring dynamic persistent volume provisioning in Kubernetes.

## Table of Contents
1. [NFS Server Setup](#nfs-server-setup)
2. [Kubernetes Cluster Preparation](#kubernetes-cluster-preparation)
3. [Manual Installation](#manual-installation)
4. [Helm Installation](#helm-installation)
5. [Testing & Verification](#testing--verification)
6. [Troubleshooting](#troubleshooting)

## NFS Server Setup

### Step 1: Install NFS Server (Ubuntu/Debian)

On your NFS server machine (e.g., IP: 10.70.34.68):

```bash
# Update package list
sudo apt update

# Install NFS server
sudo apt install nfs-kernel-server -y

# Start and enable NFS services
sudo systemctl start nfs-kernel-server
sudo systemctl enable nfs-kernel-server
sudo systemctl status nfs-kernel-server
```

### Step 2: Create NFS Directory

```bash
# Create the directory for NFS exports
sudo mkdir -p /srv/nfs/kubedata

# Set proper permissions
sudo chown nobody:nogroup /srv/nfs/kubedata
sudo chmod 777 /srv/nfs/kubedata
```

### Step 3: Configure NFS Exports

```bash
# Edit exports file
sudo nano /etc/exports

# Add the following line (replace with your Kubernetes cluster network)
/srv/nfs/kubedata    10.70.34.0/24(rw,sync,no_subtree_check,no_root_squash)
```

**Export options explanation:**
- `rw`: Read-write access
- `sync`: Synchronous writes
- `no_subtree_check`: Disable subtree checking for better performance
- `no_root_squash`: Allow root user from clients to have root privileges

### Step 4: Apply Export Configuration

```bash
# Export the shared directory
sudo exportfs -a

# Restart NFS server
sudo systemctl restart nfs-kernel-server

# Check exports
sudo exportfs -v
```

### Step 5: Configure Firewall (if enabled)

```bash
# Allow NFS through firewall
sudo ufw allow from 10.70.34.0/24 to any port nfs
sudo ufw allow from 10.70.34.0/24 to any port 2049
sudo ufw allow from 10.70.34.0/24 to any port 111
```

### Step 6: Test NFS Server

```bash
# Check if NFS is listening
sudo netstat -tulpn | grep :2049

# Show active exports
showmount -e localhost
```

## Kubernetes Cluster Preparation

### Install NFS Client on All Kubernetes Nodes

Run this on **all** Kubernetes worker and master nodes:

```bash
# Install NFS common utilities
sudo apt update && sudo apt install nfs-common -y

# Test NFS mount (optional)
sudo mkdir -p /mnt/nfs-test
sudo mount -t nfs 10.70.34.68:/srv/nfs/kubedata /mnt/nfs-test
sudo umount /mnt/nfs-test
sudo rmdir /mnt/nfs-test
```

## Manual Installation

### Step 1: Create Namespace (Optional)

```bash
kubectl create namespace nfs-provisioner
```

### Step 2: Create Service Account and RBAC

Create `rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner
  namespace: default
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "update", "patch"]
  - apiGroups: [""]
    resources: ["services", "endpoints"]
    verbs: ["get"]
  - apiGroups: ["extensions"]
    resources: ["podsecuritypolicies"]
    resourceNames: ["nfs-provisioner"]
    verbs: ["use"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: default
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: default
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: default
roleRef:
  kind: Role
  name: leader-locking-nfs-client-provisioner
  apiGroup: rbac.authorization.k8s.io
```

### Step 3: Create Storage Class

Create `storage-class.yaml`:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-client
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner
parameters:
  archiveOnDelete: "false"
  pathPattern: "${.PVC.namespace}/${.PVC.annotations.nfs.io/storage-path}"
  onDelete: delete
allowVolumeExpansion: true
volumeBindingMode: Immediate
```

### Step 4: Create Deployment

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner
  labels:
    app: nfs-client-provisioner
  namespace: default
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
        - name: nfs-client-provisioner
          image: registry.k8s.io/sig-storage/nfs-subdir-external-provisioner:v4.0.2
          volumeMounts:
            - name: nfs-client-root
              mountPath: /persistentvolumes
          env:
            - name: PROVISIONER_NAME
              value: k8s-sigs.io/nfs-subdir-external-provisioner
            - name: NFS_SERVER
              value: 10.70.34.68
            - name: NFS_PATH
              value: /srv/nfs/kubedata
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 100m
              memory: 128Mi
      volumes:
        - name: nfs-client-root
          nfs:
            server: 10.70.34.68
            path: /srv/nfs/kubedata
```

### Step 5: Apply Manual Configuration

```bash
# Apply all configurations
kubectl apply -f rbac.yaml
kubectl apply -f storage-class.yaml
kubectl apply -f deployment.yaml

# Verify deployment
kubectl get pods -l app=nfs-client-provisioner
kubectl get storageclass
```

## Helm Installation

### Step 1: Install Helm (if not already installed)

```bash
# Download and install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installation
helm version
```

### Step 2: Add Helm Repository

```bash
# Add the NFS provisioner repository
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/

# Update repository
helm repo update

# Search for available versions
helm search repo nfs-subdir-external-provisioner
```

### Step 3: Install with Basic Configuration

```bash
helm install nfs-subdir-external-provisioner \
  nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  --set nfs.server=10.70.34.68 \
  --set nfs.path=/srv/nfs/kubedata \
  --set storageClass.name=nfs-client
```

### Step 4: Install with Custom Values (Advanced)

Create `values.yaml`:

```yaml
# values.yaml
nfs:
  server: 10.70.34.68
  path: /srv/nfs/kubedata
  mountOptions: []

storageClass:
  create: true
  name: nfs-client
  defaultClass: false
  allowVolumeExpansion: true
  reclaimPolicy: Delete
  volumeBindingMode: Immediate
  archiveOnDelete: false
  accessModes: ReadWriteOnce

image:
  repository: registry.k8s.io/sig-storage/nfs-subdir-external-provisioner
  tag: v4.0.2
  pullPolicy: IfNotPresent

replicaCount: 1

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi

nodeSelector: {}
tolerations: []
affinity: {}

# Security context
podSecurityContext:
  runAsUser: 65534
  runAsGroup: 65534
  fsGroup: 65534
```

Install with custom values:

```bash
helm install nfs-subdir-external-provisioner \
  nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  -f values.yaml
```

### Step 5: Set as Default Storage Class

```bash
kubectl patch storageclass nfs-client -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

## Testing & Verification

### Step 1: Verify Installation

```bash
# Check storage class
kubectl get storageclass

# Check provisioner pod
kubectl get pods -l app=nfs-client-provisioner

# Check logs
kubectl logs -l app=nfs-client-provisioner
```

### Step 2: Create Test PVC

Create `test-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-claim
  namespace: default
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: nfs-client
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f test-pvc.yaml
kubectl get pvc
kubectl get pv
```

### Step 3: Create Test Pod

Create `test-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: test-container
    image: nginx:alpine
    volumeMounts:
    - mountPath: /data
      name: nfs-storage
    command: ["/bin/sh"]
    args: ["-c", "while true; do echo $(date) >> /data/test.log; sleep 30; done"]
  volumes:
  - name: nfs-storage
    persistentVolumeClaim:
      claimName: test-claim
```

```bash
kubectl apply -f test-pod.yaml
kubectl get pods
kubectl exec -it test-pod -- cat /data/test.log
```

### Step 4: Test with MariaDB

```bash
# Add Bitnami repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install MariaDB with NFS storage
helm install my-mariadb bitnami/mariadb \
  --set primary.persistence.storageClass=nfs-client \
  --set primary.persistence.size=8Gi
```

Check MariaDB deployment:

```bash
kubectl get pods
kubectl get pvc
kubectl describe pod my-mariadb-0

# Get MariaDB root password
kubectl get secret --namespace default my-mariadb -o jsonpath="{.data.mariadb-root-password}" | base64 -d

# Connect to MariaDB
kubectl run my-mariadb-client --rm --tty -i --restart='Never' \
  --image docker.io/bitnami/mariadb:11.8.3-debian-12-r0 \
  --namespace default --command -- bash

# Inside the client container:
mysql -h my-mariadb.default.svc.cluster.local -uroot -p
```

## Troubleshooting

### Common Issues

#### 1. NFS Server Issues
```bash
# Check NFS server status
sudo systemctl status nfs-kernel-server

# Check exports
sudo exportfs -v
showmount -e 10.70.34.68

# Check NFS logs
sudo journalctl -u nfs-kernel-server -f
```

#### 2. Permission Issues
```bash
# On NFS server, check directory permissions
ls -la /srv/nfs/kubedata

# Fix permissions if needed
sudo chown -R nobody:nogroup /srv/nfs/kubedata
sudo chmod -R 777 /srv/nfs/kubedata
```

#### 3. Network Connectivity
```bash
# Test network connectivity from Kubernetes nodes
ping 10.70.34.68
telnet 10.70.34.68 2049

# Check firewall rules on NFS server
sudo ufw status
sudo iptables -L | grep nfs
```

#### 4. Pod Issues
```bash
# Check provisioner logs
kubectl logs -l app=nfs-client-provisioner

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp

# Describe problematic pods
kubectl describe pod <pod-name>
```

### Debug Commands

```bash
# Manual NFS mount test
sudo mount -t nfs 10.70.34.68:/srv/nfs/kubedata /mnt/test
ls -la /mnt/test
sudo umount /mnt/test

# Check NFS processes
rpcinfo -p 10.70.34.68

# Monitor NFS traffic
sudo tcpdump -i any port 2049
```

## Configuration Reference

### NFS Server Export Options
| Option | Description |
|--------|-------------|
| `rw` | Read-write access |
| `ro` | Read-only access |
| `sync` | Synchronous writes (safer) |
| `async` | Asynchronous writes (faster) |
| `no_root_squash` | Don't map root to nobody |
| `root_squash` | Map root to nobody (default) |
| `no_subtree_check` | Disable subtree checking |

### Helm Chart Values
| Parameter | Description | Default |
|-----------|-------------|---------|
| `nfs.server` | NFS server IP | Required |
| `nfs.path` | NFS export path | Required |
| `storageClass.name` | Storage class name | `nfs-client` |
| `storageClass.defaultClass` | Set as default | `false` |
| `replicaCount` | Number of provisioner replicas | `1` |

## Cleanup

### Remove Test Resources
```bash
kubectl delete -f test-pod.yaml
kubectl delete -f test-pvc.yaml
```

### Remove Helm Installation
```bash
helm uninstall nfs-subdir-external-provisioner
helm uninstall my-mariadb
```

### Remove Manual Installation
```bash
kubectl delete -f deployment.yaml
kubectl delete -f storage-class.yaml
kubectl delete -f rbac.yaml
```

### Cleanup NFS Server
```bash
# Remove exports
sudo nano /etc/exports  # Remove the export line
sudo exportfs -ra

# Stop NFS server (if no longer needed)
sudo systemctl stop nfs-kernel-server
sudo systemctl disable nfs-kernel-server
```

## Best Practices

1. **Security**: Use specific subnet in NFS exports instead of `*`
2. **Backup**: Regularly backup NFS data directory
3. **Monitoring**: Monitor NFS server performance and disk space
4. **High Availability**: Consider NFS server clustering for production
5. **Resource Limits**: Set appropriate resource limits for provisioner pod
6. **Storage Class**: Create separate storage classes for different use cases

## Production Considerations

- Use dedicated NFS server with RAID storage
- Implement proper backup strategy
- Set up monitoring and alerting
- Consider network security (VPN/private networks)
- Test disaster recovery procedures
- Document your specific configuration