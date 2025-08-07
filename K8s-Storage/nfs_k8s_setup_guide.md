# Simple NFS Setup for Kubernetes on Ubuntu

## Overview
This guide shows how to set up NFS (Network File System) for shared storage across all Kubernetes nodes on Ubuntu systems.

## Prerequisites
- Ubuntu server for NFS server
- Ubuntu Kubernetes nodes
- All systems can communicate over network

## Part 1: Setup NFS Server

### Step 1: Install NFS Server
```bash
# Update system
sudo apt update

# Install NFS server
sudo apt install nfs-kernel-server -y

# Create shared directory
sudo mkdir -p /srv/nfs/k8s-data
sudo chown nobody:nogroup /srv/nfs/k8s-data
sudo chmod 755 /srv/nfs/k8s-data
```

### Step 2: Configure NFS Exports
```bash
# Edit exports file
sudo nano /etc/exports

# Add this line (replace 192.168.1.0/24 with your network)
/srv/nfs/k8s-data 192.168.1.0/24(rw,sync,no_subtree_check,no_root_squash)

# Apply configuration
sudo exportfs -a
sudo systemctl restart nfs-kernel-server

# Verify exports
sudo exportfs -v
```

### Step 3: Configure Firewall
```bash
# Allow NFS traffic
sudo ufw allow from 192.168.1.0/24 to any port nfs
sudo ufw allow from 192.168.1.0/24 to any port 111
```

## Part 2: Setup NFS Client (All Kubernetes Nodes)

Run these commands on **every** Kubernetes node:

```bash
# Install NFS client
sudo apt update
sudo apt install nfs-common -y

# Test connection (replace 192.168.1.100 with your NFS server IP)
sudo mkdir /mnt/test
sudo mount -t nfs 192.168.1.100:/srv/nfs/k8s-data /mnt/test
echo "Test from $(hostname)" | sudo tee /mnt/test/test.txt
ls /mnt/test
sudo umount /mnt/test
sudo rmdir /mnt/test
```

## Part 3: Use NFS in Kubernetes

### Method 1: Simple Pod with NFS
```yaml
# nfs-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: nfs-test
spec:
  containers:
  - name: test-container
    image: nginx
    volumeMounts:
    - name: nfs-storage
      mountPath: /usr/share/nginx/html
  volumes:
  - name: nfs-storage
    nfs:
      server: 192.168.1.100  # Replace with your NFS server IP
      path: /srv/nfs/k8s-data
```

```bash
# Deploy and test
kubectl apply -f nfs-pod.yaml
kubectl get pods
kubectl exec -it nfs-test -- ls -la /usr/share/nginx/html
```

### Method 2: Using Persistent Volume (Recommended)
```yaml
# nfs-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: 192.168.1.100  # Replace with your NFS server IP
    path: "/srv/nfs/k8s-data"

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 5Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nfs-app
  template:
    metadata:
      labels:
        app: nfs-app
    spec:
      containers:
      - name: app
        image: nginx
        volumeMounts:
        - name: shared-data
          mountPath: /usr/share/nginx/html
      volumes:
      - name: shared-data
        persistentVolumeClaim:
          claimName: nfs-pvc
```

```bash
# Deploy
kubectl apply -f nfs-pv.yaml

# Check status
kubectl get pv
kubectl get pvc
kubectl get pods
```

## Testing Your Setup

### Create Test File
```yaml
# test-shared-storage.yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
  - name: writer
    image: busybox
    command: ['sh', '-c', 'echo "Hello from writer" > /data/hello.txt; sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    nfs:
      server: 192.168.1.100  # Replace with your NFS server IP
      path: /srv/nfs/k8s-data

---
apiVersion: v1
kind: Pod
metadata:
  name: reader
spec:
  containers:
  - name: reader
    image: busybox
    command: ['sh', '-c', 'while true; do cat /data/hello.txt; sleep 10; done']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    nfs:
      server: 192.168.1.100  # Replace with your NFS server IP
      path: /srv/nfs/k8s-data
```

```bash
# Test shared storage
kubectl apply -f test-shared-storage.yaml
kubectl logs writer
kubectl logs reader
```

## Troubleshooting

### Check NFS Server Status
```bash
# On NFS server
sudo systemctl status nfs-kernel-server
sudo exportfs -v
```

### Check Client Connection
```bash
# On any Kubernetes node
showmount -e 192.168.1.100  # Replace with NFS server IP
```

### Common Pod Issues
```bash
# If pods are stuck, check events
kubectl describe pod <pod-name>

# Check if NFS client is installed on nodes
kubectl get nodes
# SSH to each node and verify: dpkg -l | grep nfs-common
```

### Permission Issues
```bash
# On NFS server, check directory permissions
ls -la /srv/nfs/
sudo chown nobody:nogroup /srv/nfs/k8s-data
sudo chmod 755 /srv/nfs/k8s-data
```

## Quick Commands Reference

```bash
# NFS Server
sudo systemctl restart nfs-kernel-server
sudo exportfs -ra  # Reload exports

# Kubernetes
kubectl get pv     # List persistent volumes
kubectl get pvc    # List persistent volume claims
kubectl get pods   # List pods

# Testing
showmount -e <nfs-server-ip>  # Show available exports
```

## Important Notes

1. **Replace IP Address**: Change `192.168.1.100` to your actual NFS server IP
2. **Network Range**: Update `192.168.1.0/24` to match your network
3. **ReadWriteMany**: NFS supports multiple pods reading/writing simultaneously
4. **Data Persistence**: Data survives pod restarts and node failures

## Simple Example Use Case

Perfect for:
- Shared configuration files
- Log aggregation
- Shared media files
- Database backups
- Application data that needs to be accessed by multiple pods

That's it! Your NFS setup is ready for Kubernetes shared storage.