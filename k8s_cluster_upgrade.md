# Kubernetes Cluster Upgrade Guide (Ubuntu)
**Upgrading from v1.32.x to v1.33.0**

## Overview
This guide covers upgrading a Kubernetes cluster on Ubuntu systems while maintaining zero-downtime for applications.

## Prerequisites
- Ubuntu 20.04/22.04 LTS
- kubectl access to the cluster
- sudo privileges on all nodes
- At least one worker node to handle workloads during upgrade

## Pre-Upgrade Steps

### 1. Check Current Status
```bash
kubectl get nodes
kubectl version --short
```

### 2. Backup etcd (Important!)
```bash
sudo ETCDCTL_API=3 etcdctl snapshot save /tmp/etcd-backup-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

## Control Plane Upgrade

### Step 1: Drain the Master Node
```bash
kubectl drain master-node --ignore-daemonsets
```

### Step 2: Upgrade kubeadm
```bash
sudo apt update
sudo apt install -y --allow-change-held-packages kubeadm=1.33.0-1.1
```

### Step 3: Verify and Plan Upgrade
```bash
kubeadm version
sudo kubeadm upgrade plan v1.33.0
```

### Step 4: Apply the Upgrade
```bash
sudo kubeadm upgrade apply v1.33.0
```

### Step 5: Upgrade kubelet and kubectl
```bash
sudo apt install -y --allow-change-held-packages kubelet=1.33.0-1.1 kubectl=1.33.0-1.1
sudo systemctl daemon-reload
sudo systemctl restart kubelet
```

### Step 6: Uncordon Master Node
```bash
kubectl uncordon master-node
kubectl get nodes
```

## Worker Node Upgrade

### Step 1: Drain Worker Node (from master)
```bash
kubectl drain worker-node-1 --ignore-daemonsets --force
```

### Step 2: Upgrade Worker Node (on worker node)
```bash
# SSH to worker node
ssh user@worker-node-1

# Upgrade kubeadm
sudo apt update
sudo apt install -y --allow-change-held-packages kubeadm=1.33.0-1.1

# Upgrade node configuration
sudo kubeadm upgrade node

# Upgrade kubelet and kubectl
sudo apt install -y --allow-change-held-packages kubelet=1.33.0-1.1 kubectl=1.33.0-1.1

# Restart kubelet
sudo systemctl daemon-reload
sudo systemctl restart kubelet
```

### Step 3: Uncordon Worker Node (from master)
```bash
kubectl uncordon worker-node-1
kubectl get nodes
```

**Repeat Steps 1-3 for each worker node**

## Verification

### Check Cluster Status
```bash
# Verify all nodes are updated
kubectl get nodes

# Check system pods
kubectl get pods -n kube-system

# Verify cluster info
kubectl cluster-info

# Check version
kubectl version --short
```

### Expected Output
```bash
$ kubectl get nodes
NAME           STATUS   ROLES           AGE   VERSION
master-node    Ready    control-plane   45d   v1.33.0
worker-node-1  Ready    <none>          45d   v1.33.0
worker-node-2  Ready    <none>          45d   v1.33.0
```

## Common Issues & Solutions

### Issue: Node won't drain
```bash
# Check what's blocking the drain
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=<node-name>

# Force drain if safe to do so
kubectl drain <node-name> --ignore-daemonsets --force --delete-emptydir-data
```

### Issue: kubeadm upgrade fails
```bash
# Check kubelet logs
sudo journalctl -xeu kubelet

# Verify system resources
df -h
free -h
```

### Issue: Pods not scheduling after uncordon
```bash
# Check node status
kubectl describe node <node-name>

# Look for taints
kubectl get node <node-name> -o yaml | grep taints -A 5
```

## Rollback (Emergency Only)

If upgrade fails completely:

```bash
# Stop kubelet on all nodes
sudo systemctl stop kubelet

# Restore etcd backup
sudo ETCDCTL_API=3 etcdctl snapshot restore /tmp/etcd-backup-<date>.db \
  --data-dir=/var/lib/etcd-restore

# Replace etcd data
sudo systemctl stop etcd
sudo mv /var/lib/etcd /var/lib/etcd-failed
sudo mv /var/lib/etcd-restore /var/lib/etcd
sudo systemctl start etcd

# Downgrade packages on all nodes
sudo apt install -y --allow-change-held-packages \
  kubeadm=1.32.x-1.1 kubelet=1.32.x-1.1 kubectl=1.32.x-1.1

# Restart services
sudo systemctl daemon-reload
sudo systemctl start kubelet
```

## Best Practices

1. **Always backup etcd** before starting
2. **Test in staging** environment first
3. **Upgrade one node at a time** to maintain availability
4. **Monitor applications** during the upgrade process
5. **Have a rollback plan** ready
6. **Upgrade during low-traffic periods**

## Quick Command Reference

```bash
# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# Drain node
kubectl drain <node-name> --ignore-daemonsets

# Upgrade packages (Ubuntu)
sudo apt update
sudo apt install -y --allow-change-held-packages kubeadm=1.33.0-1.1

# Apply upgrade (control plane only)
sudo kubeadm upgrade apply v1.33.0

# Upgrade node config (worker nodes)
sudo kubeadm upgrade node

# Upgrade kubelet/kubectl
sudo apt install -y --allow-change-held-packages kubelet=1.33.0-1.1 kubectl=1.33.0-1.1
sudo systemctl daemon-reload && sudo systemctl restart kubelet

# Uncordon node
kubectl uncordon <node-name>
```

## Summary

The upgrade process follows this pattern:
1. **Backup** → **Drain** → **Upgrade** → **Restart** → **Uncordon**
2. Do **control plane first**, then **worker nodes one by one**
3. **Verify** each step before proceeding
4. **Monitor** applications throughout the process

This ensures zero-downtime upgrades while maintaining cluster stability.