# Kubernetes Networking Complete Guide

## Table of Contents
1. [Kubernetes Network Model](#kubernetes-network-model)
2. [CNI Plugins](#cni-plugins)
3. [DNS in Kubernetes](#dns-in-kubernetes)
4. [Network Policies](#network-policies)
5. [Practical Examples](#practical-examples)
6. [Common Commands](#common-commands)
7. [Troubleshooting](#troubleshooting)

## Kubernetes Network Model

Kubernetes networking is built on a simple yet powerful model that defines how Pods communicate with each other and external services.

### Core Networking Requirements

Kubernetes imposes three fundamental networking requirements:

1. **Pod-to-Pod Communication**: Pods on any node can communicate with all Pods on all nodes without NAT
2. **Node-to-Pod Communication**: Agents on a node (kubelet, system daemons) can communicate with all Pods on that node
3. **Unique IP Addresses**: Every Pod gets its own unique IP address

### Network Architecture

```
Node 1                    Node 2
┌─────────────────┐      ┌─────────────────┐
│ Pod A           │      │ Pod D           │
│ IP: 192.168.0.2 │      │ IP: 192.168.1.2 │
├─────────────────┤      ├─────────────────┤
│ Pod B           │      │ Pod E           │
│ IP: 192.168.0.3 │      │ IP: 192.168.1.3 │
├─────────────────┤      ├─────────────────┤
│ Pod C           │      │                 │
│ IP: 192.168.0.4 │      │                 │
└─────────────────┘      └─────────────────┘
```

### Key Benefits
- **Simplicity**: No complex NAT rules or port mapping
- **Portability**: Applications work the same across environments
- **Service Discovery**: Easy communication between services
- **Security**: Network policies can control traffic flow

## CNI Plugins

**Container Network Interface (CNI)** plugins provide network connectivity between Pods according to the Kubernetes network model.

### What are CNI Plugins?
- Network plugins that implement Kubernetes networking requirements
- Responsible for Pod IP allocation and network connectivity
- Essential for cluster functionality (nodes remain NotReady without CNI)

### Popular CNI Plugins

| Plugin | Description | Use Case |
|--------|-------------|----------|
| **Calico** | Layer 3 networking with BGP | Security-focused, network policies |
| **Flannel** | Simple overlay network | Basic networking, easy setup |
| **Weave Net** | Mesh network | Multi-cloud, encryption |
| **Cilium** | eBPF-based networking | Advanced security, observability |
| **AWS VPC CNI** | Native AWS integration | AWS EKS clusters |

### Installation Example (Calico)
```bash
# Apply Calico manifest
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Verify installation
kubectl get pods -n kube-system | grep calico
```

### Selecting the Right CNI Plugin

Consider these factors when choosing:
- **Performance Requirements**: Overlay vs native routing
- **Security Needs**: Network policy support
- **Cloud Provider**: Native integration options
- **Complexity**: Setup and maintenance overhead
- **Features**: Load balancing, encryption, observability

## DNS in Kubernetes

Kubernetes uses DNS to enable service discovery within the cluster, allowing Pods to locate other Pods and Services using domain names.

### Core DNS Service
- Runs as a Service in the `kube-system` namespace
- **kubeadm** and **minikube** use **CoreDNS** by default
- Automatically configured for all Pods

### Pod DNS Naming Convention

Pods are automatically assigned domain names following this pattern:
```
pod-ip.namespace-name.pod.cluster.local
```

#### Examples:
- Pod with IP `192.168.0.20` in `default` namespace:
  ```
  192-168-0-20.default.pod.cluster.local
  ```
- Pod with IP `10.244.1.5` in `production` namespace:
  ```
  10-244-1-5.production.pod.cluster.local
  ```

### Service DNS Naming

Services follow a simpler pattern:
```
service-name.namespace.svc.cluster.local
```

#### Examples:
```bash
# Access nginx service in default namespace
curl nginx.default.svc.cluster.local

# Access database service in production namespace
curl database.production.svc.cluster.local
```

### DNS Configuration Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dns-test-pod
spec:
  containers:
    - name: test-container
      image: busybox
      command: ['sleep', '3600']
  dnsPolicy: ClusterFirst  # Use cluster DNS
```

### Testing DNS Resolution

```bash
# Test DNS resolution from within a Pod
kubectl exec -it dns-test-pod -- nslookup kubernetes.default.svc.cluster.local

# Test specific service resolution
kubectl exec -it dns-test-pod -- nslookup nginx.default.svc.cluster.local
```

## Network Policies

Network Policies control traffic flow at the IP address and port level, providing security by isolating Pods from unnecessary traffic.

### Key Concepts

- **Default Behavior**: Pods are non-isolated and accept traffic from any source
- **Isolation**: Pods become isolated when selected by a NetworkPolicy
- **Traffic Types**: Control both Ingress (incoming) and Egress (outgoing) traffic

### Network Policy Components

#### 1. Pod Selector
Determines which Pods the policy applies to:

```yaml
spec:
  podSelector:
    matchLabels:
      app: frontend  # Apply to Pods with label app=frontend
  
  # Empty selector applies to all Pods in namespace
  podSelector: {}
```

#### 2. Policy Types
Specify which traffic direction to control:

```yaml
spec:
  policyTypes:
  - Ingress    # Control incoming traffic
  - Egress     # Control outgoing traffic
```

#### 3. Traffic Selectors

**Pod Selector** - Select specific Pods:
```yaml
ingress:
- from:
  - podSelector:
      matchLabels:
        role: client
```

**Namespace Selector** - Select entire namespaces:
```yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        role: test-network-policy
```

**IP Block** - Select IP ranges:
```yaml
ingress:
- from:
  - ipBlock:
      cidr: 172.17.0.0/16
      except:
      - 172.17.1.0/24
```

#### 4. Ports
Specify allowed ports and protocols:

```yaml
# Single port
ports:
- protocol: TCP
  port: 80

# Port range
ports:
- protocol: TCP
  port: 32000
  endPort: 32768
```

### Complete Network Policy Example

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sample-network-policy
  namespace: network-policy
spec:
  # Apply to Pods with label app=frontend
  podSelector:
    matchLabels:
      app: frontend
  
  # Control both ingress and egress
  policyTypes:
  - Ingress
  - Egress
  
  # Allow ingress from specific namespace on port 80
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          role: test-network-policy
    ports:
    - protocol: TCP
      port: 80
  
  # Allow egress to DNS and specific services
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53  # DNS
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 3306
```

### Common Network Policy Patterns

#### 1. Deny All Traffic
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

#### 2. Allow from Same Namespace Only
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
spec:
  podSelector: {}
  ingress:
  - from:
    - podSelector: {}
```

#### 3. Allow from Specific Namespace
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-namespace
spec:
  podSelector:
    matchLabels:
      app: web
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: frontend
```

## Practical Examples

### Example 1: DNS Testing Setup

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
    - name: nginx
      image: nginx
---
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: test
      image: alpine
      command: ['sleep', '3600']
```

Test DNS resolution:
```bash
# Get nginx Pod IP
kubectl get pod nginx-pod -o wide

# Test from test-pod
kubectl exec -it test-pod -- nslookup [nginx-pod-ip]
```

### Example 2: Network Policy Demo

Create namespace and Pods:
```bash
# Create namespace
kubectl create namespace network-policy

# Apply Pod configurations
kubectl apply -f network-policy-pod.yml

# Apply network policy
kubectl apply -f network-policy.yml
```

Test connectivity:
```bash
# Test before policy (should work)
kubectl exec -n network-policy busybox-pod -- wget -qO- nginx-pod

# Test after policy (may be blocked based on policy rules)
kubectl exec -n network-policy busybox-pod -- wget -qO- nginx-pod
```

## Common Commands

### Networking Diagnostics
```bash
# Check cluster network info
kubectl cluster-info

# List all network policies
kubectl get networkpolicies --all-namespaces

# Describe network policy
kubectl describe networkpolicy sample-network-policy -n network-policy

# Check CNI plugin status
kubectl get pods -n kube-system | grep -E 'calico|flannel|weave'

# Check CoreDNS status
kubectl get pods -n kube-system | grep coredns
```

### DNS Testing
```bash
# Test DNS resolution from Pod
kubectl run test-pod --image=busybox --rm -it --restart=Never -- nslookup kubernetes.default

# Check DNS configuration
kubectl get configmap coredns -n kube-system -o yaml

# Test service discovery
kubectl exec -it test-pod -- nslookup my-service.default.svc.cluster.local
```

### Network Policy Management
```bash
# Create network policy
kubectl apply -f network-policy.yml

# List network policies
kubectl get netpol

# Delete network policy
kubectl delete networkpolicy sample-network-policy

# Test connectivity between Pods
kubectl exec source-pod -- curl destination-pod-ip
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Pods Can't Communicate
**Symptoms**: Connection timeouts, DNS resolution failures

**Check**:
```bash
# Verify CNI plugin is running
kubectl get pods -n kube-system

# Check Pod network settings
kubectl describe pod problem-pod

# Test basic connectivity
kubectl exec -it pod1 -- ping pod2-ip
```

#### 2. DNS Not Working
**Symptoms**: Service names don't resolve

**Check**:
```bash
# Verify CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check DNS policy
kubectl get pod problem-pod -o yaml | grep dnsPolicy

# Test DNS directly
kubectl exec -it problem-pod -- nslookup kubernetes.default
```

#### 3. Network Policy Issues
**Symptoms**: Unexpected traffic blocking or allowing

**Check**:
```bash
# Verify policy is applied
kubectl get networkpolicy

# Check Pod labels match selectors
kubectl describe pod target-pod
kubectl describe networkpolicy policy-name

# Test with and without policies
kubectl delete networkpolicy policy-name  # Test
kubectl apply -f policy.yml               # Reapply
```

### Debugging Tools

```bash
# Network troubleshooting Pod
kubectl run netshoot --rm -i --tty --image nicolaka/netshoot

# Simple connectivity test
kubectl run test-pod --image=busybox --rm -it --restart=Never

# Check iptables rules (on nodes)
sudo iptables -L

# Monitor network traffic
kubectl exec -it netshoot -- tcpdump -i eth0
```

## Best Practices

### 1. Network Security
- Always implement network policies for production workloads
- Use the principle of least privilege
- Regularly audit network policy rules
- Test policies in staging environments

### 2. DNS Configuration
- Use service discovery instead of hardcoded IPs
- Keep service names descriptive and consistent
- Avoid long DNS queries in high-frequency operations

### 3. CNI Plugin Selection
- Choose CNI plugins based on specific requirements
- Consider performance implications of overlay networks
- Plan for network policy support if needed
- Test thoroughly in production-like environments

### 4. Monitoring
- Monitor network performance and latency
- Set up alerts for network policy violations
- Use network observability tools like Cilium Hubble
- Regular connectivity testing between services

## Summary

Kubernetes networking provides a powerful and flexible foundation for container communication:

- **Network Model**: Simple, flat network where every Pod gets an IP
- **CNI Plugins**: Enable network connectivity (Calico, Flannel, etc.)
- **DNS**: Automatic service discovery within the cluster
- **Network Policies**: Security through traffic control and isolation

Understanding these concepts is crucial for building secure, scalable Kubernetes applications and troubleshooting network-related issues effectively.