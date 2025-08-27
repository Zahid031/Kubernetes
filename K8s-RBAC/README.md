# Kubernetes Access Management: RBAC and Service Accounts

A comprehensive guide to understanding and implementing Role-Based Access Control (RBAC) and Service Accounts in Kubernetes clusters.

## Table of Contents

- [Overview](#overview)
- [Kubernetes RBAC](#kubernetes-rbac)
  - [What is RBAC?](#what-is-rbac)
  - [RBAC Objects](#rbac-objects)
  - [Roles vs ClusterRoles](#roles-vs-clusterroles)
  - [RoleBinding vs ClusterRoleBinding](#rolebinding-vs-clusterrolebinding)
- [Service Accounts](#service-accounts)
  - [What are Service Accounts?](#what-are-service-accounts)
  - [Creating Service Accounts](#creating-service-accounts)
  - [Binding Service Accounts with Roles](#binding-service-accounts-with-roles)
- [Practical Examples](#practical-examples)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting](#troubleshooting)

## Overview

Kubernetes provides robust access management capabilities through Role-Based Access Control (RBAC) and Service Accounts. These mechanisms ensure that users, applications, and services have only the minimum permissions necessary to perform their intended functions, following the principle of least privilege.

## Kubernetes RBAC

### What is RBAC?

Role-Based Access Control (RBAC) in Kubernetes is a security mechanism that allows cluster administrators to:

- **Control User Access**: Manage who can access what resources in the cluster
- **Restrict Operations**: Limit read/write permissions for different users and applications
- **Enforce Security Policies**: Implement fine-grained access controls across namespaces and cluster-wide resources
- **Audit Access**: Track and monitor user activities and permissions

RBAC operates on the principle of denying access by default and explicitly granting permissions through roles and bindings.

### RBAC Objects

Kubernetes RBAC consists of four main object types:

#### 1. **Roles**
- Define permissions within a **specific namespace**
- Specify what actions can be performed on which resources
- Namespace-scoped security boundaries

#### 2. **ClusterRoles**
- Define permissions **across the entire cluster**
- Not limited to specific namespaces
- Can access cluster-wide resources (nodes, persistent volumes, etc.)

#### 3. **RoleBindings**
- Connect **Roles** to users, groups, or service accounts
- Grant permissions defined in a Role to subjects within a namespace

#### 4. **ClusterRoleBindings**
- Connect **ClusterRoles** to users, groups, or service accounts
- Grant cluster-wide permissions

### Roles vs ClusterRoles

```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                   │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   Namespace A   │    │   Namespace B   │            │
│  │                 │    │                 │            │
│  │  ┌───────────┐  │    │  ┌───────────┐  │            │
│  │  │   Roles   │  │    │  │   Roles   │  │            │
│  │  │● Permissions│  │    │  │● Permissions│  │            │
│  │  └───────────┘  │    │  └───────────┘  │            │
│  └─────────────────┘    └─────────────────┘            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ClusterRoles                       │   │
│  │            ● Permissions                        │   │
│  │            ● Cluster-wide Access                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### RoleBinding vs ClusterRoleBinding

```
Users/Groups/ServiceAccounts
           │
           ▼
┌─────────────────────┐
│    RoleBinding      │ ──── Namespace Scope ───► Role
└─────────────────────┘

┌─────────────────────┐
│ ClusterRoleBinding  │ ──── Cluster Scope ────► ClusterRole
└─────────────────────┘
```

## Service Accounts

### What are Service Accounts?

Service Accounts are Kubernetes objects that provide an identity for processes running in pods. They enable:

- **API Authentication**: Allow containerized applications to authenticate with Kubernetes APIs
- **Controlled Access**: Provide fine-grained access control for applications
- **Security**: Ensure applications can only access resources they need
- **Automation**: Enable automated processes to interact with the cluster securely

**Key Differences from User Accounts:**
- Service Accounts are for applications and processes, not humans
- They are namespaced resources
- Automatically mounted into pods (unless disabled)
- Managed entirely within Kubernetes

### Creating Service Accounts

#### Basic Service Account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-serviceaccount
  namespace: development
automountServiceAccountToken: false  # Optional: disable automatic token mounting
```

#### Service Account with Annotations

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: advanced-serviceaccount
  namespace: production
  annotations:
    description: "Service account for production workloads"
    team: "backend-team"
automountServiceAccountToken: true
```

### Binding Service Accounts with Roles

Service Accounts work with RBAC through RoleBindings and ClusterRoleBindings:

#### RoleBinding Example

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sa-pod-reader
  namespace: development
subjects:
- kind: ServiceAccount
  name: my-serviceaccount
  namespace: development
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

#### ClusterRoleBinding Example

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: sa-cluster-reader
subjects:
- kind: ServiceAccount
  name: my-serviceaccount
  namespace: development
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

## Practical Examples

### Example 1: Development Team Access

```yaml
# Create a role for developers
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: developer-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "create", "update", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update"]

---
# Bind the role to developers
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: development
subjects:
- kind: User
  name: developer-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer-role
  apiGroup: rbac.authorization.k8s.io
```

### Example 2: Monitoring Service Account

```yaml
# Service account for monitoring
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-sa
  namespace: monitoring

---
# ClusterRole for reading metrics
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: metrics-reader
rules:
- apiGroups: [""]
  resources: ["nodes", "pods", "services", "endpoints"]
  verbs: ["get", "list"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]

---
# Bind the ClusterRole to the service account
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-binding
subjects:
- kind: ServiceAccount
  name: monitoring-sa
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: metrics-reader
  apiGroup: rbac.authorization.k8s.io
```

## Best Practices

### Security Best Practices

1. **Principle of Least Privilege**
   - Grant only the minimum permissions necessary
   - Regularly audit and review permissions
   - Use namespace-scoped roles when possible

2. **Service Account Management**
   - Create dedicated service accounts for different applications
   - Disable automatic token mounting when not needed
   - Rotate service account tokens regularly

3. **Role Design**
   - Use specific resource names when possible
   - Avoid wildcard permissions (`*`) in production
   - Separate read and write permissions

### Operational Best Practices

1. **Documentation**
   - Document the purpose of each role and binding
   - Maintain an inventory of service accounts and their purposes
   - Use descriptive names and annotations

2. **Testing**
   - Test permissions in development environments first
   - Use `kubectl auth can-i` to verify permissions
   - Implement automated RBAC testing

3. **Monitoring**
   - Monitor RBAC denials and failures
   - Set up alerts for unauthorized access attempts
   - Regular security audits

## Common Use Cases

### 1. **Application Deployment**
```yaml
# CI/CD pipeline service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cicd-deployer
  namespace: production
```

### 2. **Log Collection**
```yaml
# Log collector with read-only access
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: log-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list"]
```

### 3. **Database Access**
```yaml
# Database operator with specific permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: database
  name: db-operator
rules:
- apiGroups: [""]
  resources: ["persistentvolumes", "persistentvolumeclaims"]
  verbs: ["get", "list", "create", "delete"]
```

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Check what a user can do
   kubectl auth can-i <verb> <resource> --as=<user>
   
   # Check service account permissions
   kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<namespace>:<sa-name>
   ```

2. **Service Account Token Issues**
   ```bash
   # Check if service account exists
   kubectl get serviceaccount <sa-name> -n <namespace>
   
   # Describe service account for details
   kubectl describe serviceaccount <sa-name> -n <namespace>
   ```

3. **Role and Binding Verification**
   ```bash
   # List all roles in a namespace
   kubectl get roles -n <namespace>
   
   # List all rolebindings
   kubectl get rolebindings -n <namespace>
   
   # Check cluster-wide permissions
   kubectl get clusterroles
   kubectl get clusterrolebindings
   ```

### Debug Commands

```bash
# View effective permissions
kubectl describe role <role-name> -n <namespace>
kubectl describe rolebinding <binding-name> -n <namespace>

# Test specific permissions
kubectl auth can-i create pods --as=system:serviceaccount:default:my-sa

# View all permissions for a user
kubectl auth can-i --list --as=<user>
```

## Conclusion

Kubernetes RBAC and Service Accounts provide powerful mechanisms for securing your cluster and controlling access to resources. By following the principles and examples in this guide, you can implement robust security policies that protect your applications while enabling necessary functionality.

Remember: **Security is not a one-time setup but an ongoing process**. Regularly review, audit, and update your RBAC configurations to maintain a secure Kubernetes environment.

---

## Additional Resources

- [Official Kubernetes RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Service Accounts Documentation](https://kubernetes.io/docs/concepts/security/service-accounts/)
- [Security Best Practices](https://kubernetes.io/docs/concepts/security/)

**Don't be the Same! Be Better!!!** 🚀