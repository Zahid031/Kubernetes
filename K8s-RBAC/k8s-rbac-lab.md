# Kubernetes RBAC Lab: Adding Users to a Kubernetes Cluster

This lab demonstrates how to add a new user to a Kubernetes cluster and configure Role-Based Access Control (RBAC) to limit their permissions to a specific namespace.

## Prerequisites

- A running Kubernetes cluster (Minikube is used in this example)
- kubectl CLI tool installed and configured
- OpenSSL installed on your system
- Administrative access to the cluster

## Lab Overview

We'll create a user called `DevUser` who will have access only to the `development` namespace with permissions to read and create pods.

## Step 1: Create Namespace

First, create a dedicated namespace for development work:

```bash
kubectl create namespace development
```

## Step 2: Generate Private Key and Certificate Signing Request (CSR)

Navigate to your kubectl config directory and create the user's private key:

```bash
cd ${HOME}/.kube
sudo openssl genrsa -out DevUser.key 2048
```

Create a Certificate Signing Request (CSR) for the new user:

```bash
sudo openssl req -new -key DevUser.key -out DevUser.csr -subj "/CN=DevUser/O=development"
```

**Important Notes:**
- The Common Name (CN) `DevUser` will be used as the username for authentication
- The Organization (O) `development` indicates the user's group membership

## Step 3: Generate User Certificate

Use the Kubernetes cluster's CA to sign the user's certificate:

```bash
sudo openssl x509 -req -in DevUser.csr -CA ${HOME}/.minikube/ca.crt -CAkey ${HOME}/.minikube/ca.key -CAcreateserial -out DevUser.crt -days 45
```

This creates a certificate valid for 45 days.

## Step 4: View Current Kubernetes Config

Check the current cluster configuration:

```bash
kubectl config view
```

## Step 5: Add User to Kubeconfig

Add the new user credentials to your kubectl configuration:

```bash
kubectl config set-credentials DevUser --client-certificate ${HOME}/.kube/DevUser.crt --client-key ${HOME}/.kube/DevUser.key
```

## Step 6: Verify User Addition

Check that the user was added successfully:

```bash
kubectl config view
```

## Step 7: Create Context for User

Create a context that associates the user with the development namespace:

```bash
kubectl config set-context DevUser-context --cluster=minikube --namespace=development --user=DevUser
```

## Step 8: Test Initial Access (Should Fail)

Try to list pods using the new user context:

```bash
kubectl get pods --context=DevUser-context
```

This should fail with a permissions error since we haven't created any roles yet.

## Step 9: Create a Role

Create a role definition file:

```bash
vi pod-reader-role.yml
```

Add the following content:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "create", "delete"]
```

Apply the role:

```bash
kubectl apply -f pod-reader-role.yml
```

## Step 10: Verify Role Creation

Check that the role was created successfully:

```bash
kubectl get role -n development
```

## Step 11: Create RoleBinding

Create a RoleBinding specification file:

```bash
vi pod-reader-rolebinding.yml
```

Add the following content:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: development
subjects:
- kind: User
  name: DevUser
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Apply the RoleBinding:

```bash
kubectl apply -f pod-reader-rolebinding.yml
```

## Step 12: Test User Access

Now test if the user can list pods:

```bash
kubectl get pods --context=DevUser-context
```

This should now work (may return empty list if no pods exist).

## Step 13: Test Pod Creation

Create a test pod to verify the user can create resources:

```bash
kubectl run nginx --image=nginx --context=DevUser-context
```

Verify the pod was created:

```bash
kubectl get pods --context=DevUser-context
```

## Step 14: Test Limitations

Try to access resources outside the development namespace to confirm restrictions:

```bash
kubectl get pods --context=DevUser-context -n default
```

This should fail, confirming that the user's access is properly restricted.

## Clean Up

To clean up the lab environment:

```bash
# Delete the test pod
kubectl delete pod nginx --context=DevUser-context

# Delete the RoleBinding and Role
kubectl delete rolebinding read-pods -n development
kubectl delete role pod-reader -n development

# Delete the namespace
kubectl delete namespace development

# Remove user from kubeconfig
kubectl config unset users.DevUser
kubectl config unset contexts.DevUser-context
```

## Key Concepts Learned

- **Namespaces**: Logical separation of resources within a cluster
- **Users**: Authentication entities identified by certificates
- **Roles**: Define what actions can be performed on which resources
- **RoleBindings**: Associate users with roles within specific namespaces
- **Contexts**: Combine cluster, user, and namespace information for kubectl

## Security Best Practices

- Use short-lived certificates (45 days in this example)
- Follow the principle of least privilege
- Regularly audit user permissions
- Use namespaces to isolate environments
- Monitor certificate expiration dates

## Troubleshooting

- If certificate generation fails, ensure you have proper permissions
- If kubectl commands fail, verify the context is set correctly
- Check certificate paths are correct in the kubeconfig
- Ensure the Kubernetes cluster CA files are accessible