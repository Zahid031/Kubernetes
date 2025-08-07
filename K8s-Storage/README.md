# Kubernetes Storage Guide

## Table of Contents
- [Overview](#overview)
- [Container File System](#container-file-system)
- [Volumes](#volumes)
- [Persistent Volumes (PVs)](#persistent-volumes-pvs)
- [Storage Classes](#storage-classes)
- [Persistent Volume Claims (PVCs)](#persistent-volume-claims-pvcs)
- [Volume Types](#volume-types)
- [Access Modes](#access-modes)
- [Reclaim Policies](#reclaim-policies)
- [Practical Examples](#practical-examples)
- [Best Practices](#best-practices)

## Overview

Kubernetes storage provides multiple ways to handle data persistence for containerized applications. The storage system is designed to abstract underlying storage infrastructure and provide a consistent API for applications to consume storage resources.

### Key Storage Concepts
- **Container File System**: Ephemeral storage that exists only during container lifecycle
- **Volumes**: Provide external storage accessible to containers within a Pod
- **Persistent Volumes**: Abstract storage resources that exist independently of Pods
- **Storage Classes**: Define different types of storage services available in the cluster
- **Persistent Volume Claims**: Requests for storage by users/applications

## Container File System

### Characteristics
- **Ephemeral**: Files exist only as long as the container exists
- **Temporary**: Data is lost when container is deleted or recreated
- **Local**: Files are stored within the container's file system layer

### Limitations
```
Pod Lifecycle → Container Deleted → Data Lost
```

This makes container file systems unsuitable for applications requiring data persistence.

## Volumes

Volumes solve the ephemeral storage problem by providing external storage that containers can access at runtime.

### Key Benefits
- Data persists beyond container lifecycle
- Enables data sharing between containers in the same Pod
- Supports various storage backends

### Basic Volume Configuration
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: volume-example
spec:
  volumes:
  - name: data-volume
    hostPath:
      path: /data
  containers:
  - name: app-container
    image: nginx
    volumeMounts:
    - name: data-volume
      mountPath: /usr/share/nginx/html
```

### Volume vs VolumeMount
- **Volume**: Defined in Pod spec, specifies the volume type and data location
- **VolumeMount**: Defined in container spec, references the volume and provides mount path

## Persistent Volumes (PVs)

Persistent Volumes provide a more advanced abstraction for storage management, allowing users to treat storage as an abstract resource.

### Characteristics
- **Cluster Resource**: PVs are cluster-level resources like nodes
- **Independent Lifecycle**: Exist independently of Pods that use them
- **Abstract Interface**: Hide underlying storage implementation details

### PV Example
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: static-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  hostPath:
    path: /var/tmp
```

## Storage Classes

Storage Classes allow administrators to describe different types of storage services available on their platform.

### Purpose
- Define storage characteristics (performance, cost, location)
- Enable dynamic provisioning of storage
- Provide abstraction for different storage backends

### Examples

#### Development Storage (Slow)
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: slow
provisioner: kubernetes.io/aws-ebs
parameters:
  type: io1
  iopsPerGB: "10"
  fsType: ext4
```

#### Production Storage (Fast)
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
allowedTopologies:
- matchLabelExpressions:
  - key: failure-domain.beta.kubernetes.io/zone
    values:
    - us-central1-a
```

### Volume Expansion
```yaml
allowVolumeExpansion: true  # Enables resizing after creation
```

## Persistent Volume Claims (PVCs)

PVCs are requests for storage by users, similar to how Pods request compute resources.

### Binding Process
1. User creates a PVC with specific requirements
2. Kubernetes searches for a PV that meets the criteria
3. If found, the PVC is automatically bound to the PV
4. Pod can then use the PVC to access storage

### PVC Example
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: web-storage-claim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: fast
```

### Using PVC in Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: web-storage
      mountPath: /var/www/html
  volumes:
  - name: web-storage
    persistentVolumeClaim:
      claimName: web-storage-claim
```

## Volume Types

### Common Volume Types

#### emptyDir
- Created when Pod is assigned to a node
- Persists as long as Pod runs on the node
- Perfect for temporary storage and container communication

```yaml
volumes:
- name: temp-storage
  emptyDir: {}
```

#### hostPath
- Mounts a file or directory from the host node
- Data persists beyond Pod lifecycle
- Use with caution due to node dependency

```yaml
volumes:
- name: host-storage
  hostPath:
    path: /data
    type: Directory
```

#### configMap & secret
- Mount configuration data and sensitive information
- Read-only volumes for application configuration

```yaml
volumes:
- name: config-volume
  configMap:
    name: app-config
- name: secret-volume
  secret:
    secretName: app-secrets
```

#### Cloud Storage
- **AWS EBS**: Block storage for AWS
- **GCE Persistent Disk**: Block storage for Google Cloud
- **Azure Disk**: Block storage for Microsoft Azure

#### Network File Systems
- **NFS**: Network File System for shared storage
- **Ceph**: Distributed storage system
- **GlusterFS**: Scale-out network-attached storage

## Access Modes

### Available Access Modes
- **ReadWriteOnce (RWO)**: Volume can be mounted read-write by a single node
- **ReadOnlyMany (ROX)**: Volume can be mounted read-only by many nodes
- **ReadWriteMany (RWX)**: Volume can be mounted read-write by many nodes
- **ReadWriteOncePod (RWOP)**: Volume can be mounted read-write by a single Pod

### Compatibility Matrix
| Volume Type | RWO | ROX | RWX | RWOP |
|-------------|-----|-----|-----|------|
| emptyDir    | ✓   | ✓   | ✓   | ✓    |
| hostPath    | ✓   | ✓   | ✓   | ✓    |
| NFS         | ✓   | ✓   | ✓   | ✓    |
| AWS EBS     | ✓   | -   | -   | ✓    |
| GCE PD      | ✓   | ✓   | -   | ✓    |

## Reclaim Policies

Defines what happens to storage when the associated PVC is deleted.

### Policy Types
- **Retain**: Keep all data, requires manual cleanup
- **Delete**: Automatically delete underlying storage (cloud resources only)
- **Recycle**: Automatically delete data, allow PV reuse (deprecated)

```yaml
persistentVolumeReclaimPolicy: Retain
```

## Practical Examples

### Sharing Volumes Between Containers
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  volumes:
  - name: shared-data
    emptyDir: {}
  containers:
  - name: nginx-container
    image: nginx
    volumeMounts:
    - name: shared-data
      mountPath: /usr/share/nginx/html
  - name: debian-container
    image: debian
    volumeMounts:
    - name: shared-data
      mountPath: /pod-data
    command: ["/bin/sh"]
    args: ["-c", "echo Hello from Debian > /pod-data/index.html; sleep 3600"]
```

### Dynamic Provisioning with Storage Class
```yaml
# Storage Class
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ssd-storage
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  zones: us-central1-a

---
# PVC using the Storage Class
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-claim
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: ssd-storage
  resources:
    requests:
      storage: 10Gi
```

## Best Practices

### Storage Selection
1. **Use emptyDir for**: Temporary files, cache, scratch space
2. **Use PVs/PVCs for**: Database storage, user uploads, application state
3. **Use ConfigMaps/Secrets for**: Configuration files, credentials

### Performance Optimization
1. **Choose appropriate storage class** based on performance requirements
2. **Use local storage** for high-performance applications when possible
3. **Consider network latency** for remote storage solutions

### Security Considerations
1. **Use secrets** for sensitive data instead of regular volumes
2. **Implement proper RBAC** for PV and PVC access
3. **Encrypt data at rest** when using cloud storage

### Operational Guidelines
1. **Monitor storage usage** and set up alerts for capacity
2. **Implement backup strategies** for critical data
3. **Use volume snapshots** for point-in-time recovery
4. **Regular cleanup** of unused PVs and PVCs

### Troubleshooting Common Issues
1. **PVC stuck in Pending**: Check storage class, available PVs, and resource requirements
2. **Volume mount failures**: Verify volume paths, permissions, and node connectivity
3. **Performance issues**: Check storage class configuration and underlying storage performance

## Quick Reference Commands

```bash
# List persistent volumes
kubectl get pv

# List persistent volume claims
kubectl get pvc

# Describe a specific PV
kubectl describe pv <pv-name>

# Describe a specific PVC
kubectl describe pvc <pvc-name>

# List storage classes
kubectl get storageclass

# Check volume mounts in a pod
kubectl describe pod <pod-name>
```

---

**Remember**: Choose the right storage solution based on your application's persistence, performance, and sharing requirements. Start with simple volumes for basic needs and move to PVs/PVCs for production workloads requiring durability and flexibility.