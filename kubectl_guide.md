# kubectl Command Guide - Learn Kubernetes by Doing

## What is kubectl?

`kubectl` is the command-line tool for interacting with Kubernetes clusters. It communicates with the Kubernetes API server to manage cluster resources like pods, deployments, and services.

---

## Essential kubectl Commands

### 1. kubectl get
List and display resources in your cluster.

```bash
kubectl get <resource-type>
```

#### Common Examples:
```bash
# Basic resource listing
kubectl get pods
kubectl get services
kubectl get nodes
kubectl get deployments

# Output formats
kubectl get pods -o yaml      # YAML format
kubectl get pods -o json      # JSON format
kubectl get pods -o wide      # Extended information

# Filtering and sorting
kubectl get pods --selector=app=nginx    # Filter by label
kubectl get pods --sort-by=.metadata.name   # Sort by name
kubectl get pods -A                      # All namespaces
```

---

### 2. kubectl describe
Get detailed information about a specific resource.

```bash
kubectl describe <resource-type> <resource-name>
```

#### Examples:
```bash
kubectl describe pod my-pod
kubectl describe service my-service
kubectl describe node worker-node-1
```

**What you'll see:**
- Resource configuration details
- Current status and conditions
- Recent events
- Associated resources

---

### 3. kubectl create
Create resources from YAML files.

```bash
kubectl create -f <filename>.yaml
```

#### Examples:
```bash
kubectl create -f deployment.yaml
kubectl create -f service.yaml

# Create multiple resources
kubectl create -f ./manifests/
```

**Note:** Fails if the resource already exists.

---

### 4. kubectl apply
Apply configuration changes to resources. Creates new resources or updates existing ones.

```bash
kubectl apply -f <filename>.yaml
```

#### Examples:
```bash
kubectl apply -f deployment.yaml
kubectl apply -f ./k8s-configs/

# Dry run to see what would change
kubectl apply -f deployment.yaml --dry-run=client
```

**Key Difference:** `apply` updates existing resources, `create` only creates new ones.

---

### 5. kubectl delete
Remove resources from the cluster.

```bash
kubectl delete <resource-type> <resource-name>
kubectl delete -f <filename>.yaml
```

#### Examples:
```bash
# Delete specific resources
kubectl delete pod my-pod
kubectl delete deployment my-app

# Delete from file
kubectl delete -f deployment.yaml

# Delete by label
kubectl delete pods -l app=nginx
```

---

### 6. kubectl exec
Execute commands inside running containers.

```bash
kubectl exec -it <pod-name> -- <command>
```

#### Examples:
```bash
# Interactive shell access
kubectl exec -it donetick-6b444c8c89-8wj86 -- /bin/bash
kubectl exec -it my-pod -- /bin/sh

# Run specific commands
kubectl exec my-pod -- ls /app
kubectl exec my-pod -- cat /etc/hostname

# Multi-container pods
kubectl exec -it my-pod -c container-name -- /bin/bash
```

**Requirements:** Pod must be in running state.

---

## Practical Usage Examples

### Debugging Workflow
```bash
# 1. Check what's running
kubectl get pods

# 2. Get detailed info about problematic pod
kubectl describe pod failing-pod

# 3. Access the container for investigation
kubectl exec -it failing-pod -- /bin/bash

# 4. Check logs
kubectl logs failing-pod
```

### Application Deployment Workflow
```bash
# 1. Deploy application
kubectl apply -f deployment.yaml

# 2. Verify deployment
kubectl get deployments
kubectl get pods

# 3. Check service connectivity
kubectl get services
kubectl describe service my-service

# 4. Update application
# (modify deployment.yaml)
kubectl apply -f deployment.yaml
```

---

## Output Formatting Options

| Flag | Description | Example |
|------|-------------|---------|
| `-o yaml` | YAML format | `kubectl get pod my-pod -o yaml` |
| `-o json` | JSON format | `kubectl get pods -o json` |
| `-o wide` | Extended table | `kubectl get pods -o wide` |
| `-A` | All namespaces | `kubectl get pods -A` |
| `-l` | Label selector | `kubectl get pods -l app=nginx` |

---

## Quick Reference

### Most Used Commands
```bash
# Check cluster status
kubectl get nodes
kubectl get pods -A

# Deploy applications
kubectl apply -f app.yaml

# Debug issues
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl exec -it <pod-name> -- /bin/bash

# Clean up
kubectl delete -f app.yaml
```

### Command Summary

| Command | Purpose | Usage |
|---------|---------|-------|
| `get` | List resources | `kubectl get pods` |
| `describe` | Detailed resource info | `kubectl describe pod my-pod` |
| `create` | Create new resources | `kubectl create -f file.yaml` |
| `apply` | Create/update resources | `kubectl apply -f file.yaml` |
| `delete` | Remove resources | `kubectl delete pod my-pod` |
| `exec` | Run commands in containers | `kubectl exec -it pod -- bash` |

---

## Best Practices

1. **Use `apply` for GitOps workflows** - Better for version-controlled deployments
2. **Always check before deleting** - Use `kubectl get` to verify resources
3. **Use labels for filtering** - Makes resource management easier
4. **Test with dry-run** - Use `--dry-run=client` to preview changes
5. **Use namespaces** - Organize resources logically

---

## Next Steps

Practice these commands on a live cluster:
1. Start with `kubectl get` to explore existing resources
2. Use `kubectl describe` to understand resource details  
3. Try `kubectl exec` to access running containers
4. Deploy a simple application using `kubectl apply`

---

**Remember:** kubectl uses the Kubernetes API internally, so ensure you have proper cluster access and permissions configured!