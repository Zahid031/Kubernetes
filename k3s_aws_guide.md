# 🚀 K3s Kubernetes Cluster on AWS EC2

A comprehensive guide to deploy a lightweight K3s Kubernetes cluster on AWS EC2 with one master node and two worker nodes.

## 📋 Overview

**K3s** is a lightweight Kubernetes distribution perfect for resource-constrained environments. This guide will help you set up a complete cluster on AWS EC2.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Master Node   │    │  Worker Node 1  │    │  Worker Node 2  │
│    (Control)    │    │                 │    │                 │
│   EC2 Instance  │    │  EC2 Instance   │    │  EC2 Instance   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Prerequisites

- AWS Account with appropriate permissions
- Basic knowledge of AWS VPC, EC2, and Kubernetes concepts
- Ubuntu AMI instances (t2.micro or t3.micro for free tier)

---

## 🌐 Part 1: AWS VPC Setup

### Step 1: Create VPC
1. Navigate to **AWS Management Console** → Search **"VPC"**
2. Click **"Your VPCs"** → **"Create VPC"**
3. Configure:
   - **Name**: `k3s-cluster-vpc`
   - **IPv4 CIDR**: `10.0.0.0/16`

### Step 2: Create Public Subnet
1. Click **"Subnets"** → **"Create Subnet"**
2. Configure:
   - **VPC**: Select your created VPC
   - **CIDR Block**: `10.0.1.0/24`
3. **Edit subnet settings** → Enable **"Auto-assign public IPv4 address"**

### Step 3: Internet Gateway
1. Click **"Internet Gateways"** → **"Create internet gateway"**
2. **Actions** → **"Attach to VPC"** → Select your VPC

### Step 4: Route Table
1. Click **"Route Tables"** → **"Create route table"**
2. Associate with your VPC
3. Add route: `0.0.0.0/0` → Target: Internet Gateway
4. **Subnet Associations** → Associate with your public subnet

---

## 💻 Part 2: EC2 Instance Setup

### Launch Instances
Create **3 EC2 instances**:
- ✅ **1 Master Node** (Control Plane)  
- ✅ **2 Worker Nodes**

**Instance Configuration:**
- **AMI**: Ubuntu Server (Latest)
- **Instance Type**: `t2.micro` or `t3.micro`
- **Network**: Your VPC and public subnet
- **Security Group**: Allow SSH (22), K3s (6443), HTTP (80), HTTPS (443)

---

## 🔧 Part 3: K3s Installation

### Access Instances
**Option 1: SSH Key**
```bash
ssh -i path_to_your_key.pem ubuntu@your_instance_ip
```

**Option 2: EC2 Instance Connect** *(Recommended)*
1. Select instance → **"Connect"** → **"EC2 Instance Connect"**
2. Open browser terminal

### Install K3s on Master Node

```bash
# Install K3s master
curl -sfL https://get.k3s.io | sh -

# Verify installation
sudo kubectl get nodes
```

### Test Connectivity
```bash
# From master node, test connectivity to workers
ping <worker-1-private-ip>
ping <worker-2-private-ip>
```

### Get Node Token
```bash
# On master node - copy this token
sudo cat /var/lib/rancher/k3s/server/node-token
```

### Join Worker Nodes
**On each worker node:**
```bash
# Replace <master-private-ip> and <token> with actual values
curl -sfL https://get.k3s.io | K3S_URL=https://<master-private-ip>:6443 K3S_TOKEN=<token> sh -
```

### Verify Cluster
**On master node:**
```bash
sudo kubectl get nodes
```

**Expected Output:**
```
NAME         STATUS   ROLES                  AGE   VERSION
master       Ready    control-plane,master   5m    v1.28.x+k3s1
worker-1     Ready    <none>                 2m    v1.28.x+k3s1
worker-2     Ready    <none>                 2m    v1.28.x+k3s1
```

---

## 🚀 Part 4: Deploy Nginx Application

### Create Deployment File
```bash
vi k3s-app.yml
```

**Add the following configuration:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k3s-app
  labels:
    app: k3s-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: k3s-app
  template:
    metadata:
      labels:
        app: k3s-app
    spec:
      containers:
        - name: k3s-app
          image: nginx:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: k3s-app-service
  name: k3s-app-service
spec:
  ports:
    - name: "3000-80"
      port: 3000
      protocol: TCP
      targetPort: 80
  selector:
    app: k3s-app
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: k3s-app-ingress
  annotations:
    ingress.kubernetes.io/ssl-redirect: "false"
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: k3s-app-service
                port:
                  number: 3000
```

### Deploy Application
```bash
# Apply the configuration
sudo kubectl apply -f k3s-app.yml

# Verify deployment
sudo kubectl get deployments
sudo kubectl get services  
sudo kubectl get ingress
```

### Test Deployment
```bash
# Get node information
sudo kubectl get nodes -o wide

# Test from terminal (replace with actual node IP)
curl <node-ip>

# Or access via browser using node's public IP
```

---

## 📊 Resource Overview

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **VPC** | Network isolation | `10.0.0.0/16` |
| **Subnet** | Instance placement | `10.0.1.0/24` |
| **Internet Gateway** | Internet access | Attached to VPC |
| **EC2 Instances** | Cluster nodes | 3x Ubuntu instances |
| **K3s Master** | Control plane | Manages cluster |
| **K3s Workers** | Workload nodes | Run applications |

---

## ✅ Verification Commands

```bash
# Check cluster status
sudo kubectl get nodes

# Check all resources
sudo kubectl get all

# Check specific resources
sudo kubectl get deployments
sudo kubectl get services
sudo kubectl get pods

# View pod logs
sudo kubectl logs <pod-name>
```

---

## 🧹 Cleanup

To clean up resources:

```bash
# Delete application
sudo kubectl delete -f k3s-app.yml

# Terminate EC2 instances
# Delete VPC components (in reverse order)
```

---

## 🎯 Summary

You have successfully:
- ✅ Created an AWS VPC with proper networking
- ✅ Launched 3 EC2 instances 
- ✅ Installed K3s cluster (1 master + 2 workers)
- ✅ Deployed and tested an Nginx application
- ✅ Configured Kubernetes services and ingress

**🎉 Congratulations! Your K3s cluster is ready for production workloads.**

---

## 📚 Additional Resources

- [K3s Documentation](https://k3s.io/)
- [AWS VPC Guide](https://docs.aws.amazon.com/vpc/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

*Happy Clustering! 🚀*