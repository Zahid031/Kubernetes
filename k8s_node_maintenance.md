# Kubernetes Node Maintenance Guide

## Table of Contents
- [Overview](#overview)
- [What is Node Draining](#what-is-node-draining)
- [When to Drain Nodes](#when-to-drain-nodes)
- [How to Drain a Node](#how-to-drain-a-node)
- [Handling DaemonSets](#handling-daemonsets)
- [Uncordoning a Node](#uncordoning-a-node)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Cluster maintenance is a critical aspect of managing Kubernetes environments. During maintenance operations, you may need to remove nodes from the cluster temporarily or permanently without impacting running applications. This guide covers the essential processes of node draining and uncordoning.

## What is Node Draining

**Node Draining** is the process of gracefully evicting all pods from a node before performing maintenance operations. When you drain a node:

- All containers running on that node are gracefully terminated
- Pods are automatically rescheduled to other available nodes in the cluster
- The node is marked as unschedulable, preventing new pods from being assigned to it
- Applications continue running without interruption on other nodes

This ensures zero-downtime maintenance operations while maintaining application availability.

## When to Drain Nodes

You should drain nodes in the following scenarios:

### Planned Maintenance
- Operating system updates and patches
- Hardware upgrades or replacements
- Node configuration changes
- Kubernetes version upgrades

### Troubleshooting
- Node performance issues
- Hardware failures
- Network connectivity problems
- Resource exhaustion

### Scaling Operations
- Removing nodes from the cluster
- Replacing nodes with different specifications

## How to Drain a Node

### Basic Drain Command

```bash
kubectl drain <node-name>
```

### Common Drain Options

```bash
# Basic drain with grace period
kubectl drain <node-name> --grace-period=300

# Force drain (use with caution)
kubectl drain <node-name> --force

# Drain with timeout
kubectl drain <node-name> --timeout=600s

# Delete emptyDir data
kubectl drain <node-name> --delete-emptydir-data
```

### Step-by-Step Drain Process

1. **Identify the target node:**
   ```bash
   kubectl get nodes
   ```

2. **Check pods running on the node:**
   ```bash
   kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name>
   ```

3. **Drain the node:**
   ```bash
   kubectl drain <node-name>
   ```

4. **Verify the node status:**
   ```bash
   kubectl get nodes
   # The node should show as "Ready,SchedulingDisabled"
   ```

## Handling DaemonSets

DaemonSets are special pod types that run on every node (or a subset of nodes) in the cluster. Examples include:
- Log collectors (Fluentd, Fluent Bit)
- Monitoring agents (Node Exporter)
- Network plugins (Calico, Flannel)
- Storage drivers

### The DaemonSet Challenge

When draining a node, DaemonSets can prevent the operation from completing because:
- DaemonSets are designed to run on every node
- They cannot be rescheduled to other nodes
- The drain command will wait indefinitely for them to terminate

### Ignoring DaemonSets

To proceed with draining when DaemonSets are present:

```bash
kubectl drain <node-name> --ignore-daemonsets
```

### Complete Example with DaemonSets

```bash
# List all DaemonSets in the cluster
kubectl get daemonsets --all-namespaces

# Drain node while ignoring DaemonSets
kubectl drain worker-node-1 --ignore-daemonsets --delete-emptydir-data --grace-period=300
```

## Uncordoning a Node

**Uncordoning** makes a node schedulable again, allowing new pods to be assigned to it.

### Basic Uncordon Command

```bash
kubectl uncordon <node-name>
```

### When to Uncordon

- After completing maintenance operations
- When the node is healthy and ready to accept workloads
- To restore full cluster capacity

### Verification After Uncordoning

```bash
# Check node status (should show "Ready")
kubectl get nodes

# Verify pods can be scheduled on the node
kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name>
```

## Best Practices

### Pre-Drain Checklist

1. **Verify cluster health:**
   ```bash
   kubectl get nodes
   kubectl get pods --all-namespaces
   ```

2. **Check resource availability:**
   ```bash
   kubectl top nodes
   kubectl describe nodes
   ```

3. **Identify critical workloads:**
   ```bash
   kubectl get pods --all-namespaces -o wide
   ```

### During Drain

1. **Monitor the drain process:**
   ```bash
   kubectl get pods --all-namespaces --watch
   ```

2. **Use appropriate timeouts:**
   ```bash
   kubectl drain <node-name> --timeout=300s
   ```

3. **Handle persistent volumes carefully:**
   ```bash
   kubectl get pv
   kubectl get pvc --all-namespaces
   ```

### Post-Maintenance

1. **Verify node health:**
   ```bash
   kubectl describe node <node-name>
   ```

2. **Check system pods:**
   ```bash
   kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name>
   ```

3. **Monitor application health:**
   ```bash
   kubectl get deployments --all-namespaces
   kubectl get services --all-namespaces
   ```

## Troubleshooting

### Common Issues and Solutions

#### Pods Stuck in Terminating State

```bash
# Check for finalizers or stuck resources
kubectl describe pod <pod-name> -n <namespace>

# Force delete if necessary (use with extreme caution)
kubectl delete pod <pod-name> -n <namespace> --force --grace-period=0
```

#### PodDisruptionBudget Violations

```bash
# Check PodDisruptionBudgets
kubectl get pdb --all-namespaces

# Temporarily adjust PDB if necessary
kubectl patch pdb <pdb-name> -p '{"spec":{"minAvailable":0}}'
```

#### StatefulSet Considerations

```bash
# For StatefulSets, ensure proper order during drain
kubectl get statefulsets --all-namespaces
kubectl scale statefulset <name> --replicas=0 -n <namespace>
```

### Emergency Procedures

#### Force Drain (Last Resort)

```bash
kubectl drain <node-name> --force --ignore-daemonsets --delete-emptydir-data --grace-period=0
```

**⚠️ Warning:** Force draining can cause data loss and should only be used in emergency situations.

## Complete Maintenance Workflow

### 1. Pre-Maintenance Phase
```bash
# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# Verify sufficient resources on other nodes
kubectl top nodes
```

### 2. Drain Phase
```bash
# Drain the node
kubectl drain worker-node-1 --ignore-daemonsets --delete-emptydir-data --grace-period=300

# Verify drain completed
kubectl get nodes
kubectl get pods --all-namespaces --field-selector spec.nodeName=worker-node-1
```

### 3. Maintenance Phase
```bash
# Perform your maintenance operations
# - OS updates
# - Hardware changes
# - Configuration updates
```

### 4. Recovery Phase
```bash
# Uncordon the node
kubectl uncordon worker-node-1

# Verify node is ready
kubectl get nodes

# Monitor pod distribution
kubectl get pods --all-namespaces -o wide
```

## Conclusion

Proper node maintenance using drain and uncordon operations is essential for maintaining a healthy Kubernetes cluster while ensuring zero-downtime for applications. Always follow the pre-maintenance checklist, handle DaemonSets appropriately, and verify cluster health after operations complete.

Remember that draining is a powerful operation that affects running workloads, so always plan maintenance windows carefully and have rollback procedures ready in case of issues.