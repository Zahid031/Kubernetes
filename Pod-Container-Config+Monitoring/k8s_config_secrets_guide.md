# Kubernetes Application Configuration: ConfigMaps and Secrets

## Table of Contents
1. [Overview](#overview)
2. [Application Configuration](#application-configuration)
3. [ConfigMaps](#configmaps)
4. [Secrets](#secrets)
5. [Using ConfigMaps and Secrets](#using-configmaps-and-secrets)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

## Overview

Kubernetes provides two primary mechanisms for managing application configuration:
- **ConfigMaps**: For non-sensitive configuration data
- **Secrets**: For sensitive data like passwords, tokens, and keys

These resources allow you to externalize configuration from your application code, making your applications more portable and easier to manage across different environments.

## Application Configuration

Application configuration in Kubernetes refers to the settings that influence application behavior at runtime. Key benefits include:

- **Separation of Concerns**: Configuration is separated from application code
- **Environment Flexibility**: Different configurations for dev, staging, production
- **Dynamic Updates**: Configuration can be changed without rebuilding images
- **Security**: Sensitive data is handled securely through Secrets

## ConfigMaps

ConfigMaps store non-sensitive data in key-value pairs, allowing you to decouple configuration artifacts from image content.

### Creating ConfigMaps

#### Method 1: From Command Line

**From literal values:**
```bash
kubectl create configmap my-config \
  --from-literal=key1=value1 \
  --from-literal=key2=value2
```

**From files:**
```bash
kubectl create configmap my-config --from-file=/path/to/file.properties
```

**From directories:**
```bash
kubectl create configmap my-config --from-file=/path/to/directory/
```

**From environment files:**
```bash
kubectl create configmap my-config --from-env-file=/path/to/.env
```

#### Method 2: YAML Manifest

**Basic ConfigMap Example:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: player-pro-demo
  namespace: default
data:
  # Simple key-value pairs
  player_lives: "5"
  properties_file_name: "user-interface.properties"
  
  # File-like keys (multi-line values)
  base.properties: |
    enemy.types=aliens,monsters
    player.maximum-lives=10
    game.difficulty=medium
  
  user-interface.properties: |
    color.good=purple
    color.bad=yellow
    allow.textmode=true
    theme=dark
```

**POSIX-Compliant ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: player-posix-demo
data:
  PLAYER_LIVES: "5"
  PROPERTIES_FILE_NAME: "user-interface.properties"
  BASE_PROPERTIES: "Template1"
  USER_INTERFACE_PROPERTIES: "Dark"
  DATABASE_HOST: "mysql.example.com"
  DATABASE_PORT: "3306"
```

### ConfigMap Data Types

ConfigMaps support various data types:

1. **String Values**: Simple text values
2. **Binary Data**: Using `binaryData` field for binary files
3. **Multi-line Strings**: Using `|` or `>` YAML syntax
4. **JSON/XML**: Complex structured data as strings

**Example with Binary Data:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: binary-config
data:
  # Text data
  config.txt: |
    This is a text configuration
binaryData:
  # Binary data (base64 encoded)
  app.jar: <base64-encoded-binary-data>
```

## Secrets

Secrets are designed to hold sensitive information such as passwords, OAuth tokens, SSH keys, and TLS certificates.

### Secret Types

Kubernetes supports several built-in secret types:

1. **Opaque**: Arbitrary user-defined data (default)
2. **kubernetes.io/service-account-token**: Service account token
3. **kubernetes.io/dockercfg**: Docker registry credentials
4. **kubernetes.io/tls**: TLS certificate and key
5. **kubernetes.io/ssh-auth**: SSH authentication
6. **kubernetes.io/basic-auth**: Basic authentication

### Creating Secrets

#### Method 1: From Command Line

**Generic secret:**
```bash
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=secretpassword
```

**From files:**
```bash
kubectl create secret generic db-user-pass \
  --from-file=./username.txt \
  --from-file=./password.txt
```

**TLS secret:**
```bash
kubectl create secret tls my-tls-secret \
  --cert=path/to/tls.cert \
  --key=path/to/tls.key
```

**Docker registry secret:**
```bash
kubectl create secret docker-registry my-registry-secret \
  --docker-server=docker.io \
  --docker-username=myusername \
  --docker-password=mypassword \
  --docker-email=myemail@example.com
```

#### Method 2: YAML Manifest

**Basic Secret (with data field - base64 encoded):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: example-secret
type: Opaque
data:
  username: YWRtaW4=        # base64 encoded "admin"
  password: cGFzc3dvcmQ=    # base64 encoded "password"
```

**Secret with stringData (plain text - automatically encoded):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: example-secret-string
type: Opaque
stringData:
  username: admin
  password: adminpassword
  api-key: sk-1234567890abcdef
  database-url: "postgresql://user:pass@localhost:5432/mydb"
```

**TLS Secret:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate>
  tls.key: <base64-encoded-private-key>
```

### Base64 Encoding/Decoding

**Encoding:**
```bash
echo -n 'admin' | base64
# Output: YWRtaW4=

echo -n 'secretpassword' | base64
# Output: c2VjcmV0cGFzc3dvcmQ=
```

**Decoding:**
```bash
echo 'YWRtaW4=' | base64 --decode
# Output: admin
```

## Using ConfigMaps and Secrets

### Method 1: Environment Variables

#### Using `env` Field

**From ConfigMap:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-env-demo
spec:
  containers:
  - name: demo-container
    image: nginx
    env:
    # Single environment variable from ConfigMap
    - name: PLAYER_LIVES
      valueFrom:
        configMapKeyRef:
          name: player-pro-demo
          key: player_lives
    
    # Single environment variable from Secret
    - name: SECRET_USERNAME
      valueFrom:
        secretKeyRef:
          name: example-secret
          key: username
          
    # Optional key (won't fail if key doesn't exist)
    - name: OPTIONAL_CONFIG
      valueFrom:
        configMapKeyRef:
          name: player-pro-demo
          key: optional_key
          optional: true
```

#### Using `envFrom` Field

**POSIX-compliant environment variables:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-posix-demo
spec:
  containers:
  - name: demo-container
    image: nginx
    envFrom:
    # All keys from ConfigMap become environment variables
    - configMapRef:
        name: player-posix-demo
    
    # All keys from Secret become environment variables
    - secretRef:
        name: example-secret
        
    # With prefix
    - configMapRef:
        name: player-posix-demo
      prefix: GAME_
```

### Method 2: Volume Mounts

#### Mounting as Files

**Complete Pod with Volume Mounts:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-vol-demo
spec:
  containers:
  - name: demo-container
    image: nginx
    volumeMounts:
    # Mount ConfigMap as files
    - name: config-volume
      mountPath: /etc/config/configmap
      readOnly: true
      
    # Mount Secret as files
    - name: secret-volume
      mountPath: /etc/config/secrets
      readOnly: true
      
    # Mount specific keys only
    - name: specific-config
      mountPath: /etc/specific
      readOnly: true
      
  volumes:
  # ConfigMap volume
  - name: config-volume
    configMap:
      name: player-pro-demo
      
  # Secret volume
  - name: secret-volume
    secret:
      secretName: example-secret
      defaultMode: 0400  # Read-only for owner
      
  # Specific keys from ConfigMap
  - name: specific-config
    configMap:
      name: player-pro-demo
      items:
      - key: base.properties
        path: base.conf
      - key: user-interface.properties
        path: ui.conf
        mode: 0644
```

#### Subpath Mounting

**Mounting specific files without overwriting directories:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: subpath-demo
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/nginx.conf
      subPath: nginx.conf
      readOnly: true
  volumes:
  - name: config-volume
    configMap:
      name: nginx-config
```

### Method 3: Projected Volumes

**Combining multiple sources:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: projected-demo
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: combined-volume
      mountPath: /etc/combined
  volumes:
  - name: combined-volume
    projected:
      sources:
      - configMap:
          name: player-pro-demo
      - secret:
          name: example-secret
      - secret:
          name: tls-secret
          items:
          - key: tls.crt
            path: certificates/tls.crt
```

## Advanced Configuration Patterns

### Dynamic Configuration with Deployments

**Deployment using ConfigMap:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web-app
        image: nginx:1.21
        envFrom:
        - configMapRef:
            name: app-config
        volumeMounts:
        - name: app-secrets
          mountPath: /etc/secrets
          readOnly: true
      volumes:
      - name: app-secrets
        secret:
          secretName: app-secrets
```

### Immutable ConfigMaps and Secrets

**Immutable ConfigMap (Kubernetes 1.19+):**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: immutable-config
immutable: true
data:
  config.yaml: |
    database:
      host: postgres.example.com
      port: 5432
```

**Benefits of immutable resources:**
- Better performance (no watch required)
- Reduced API server load
- Protection against accidental updates

### Multi-Environment Configuration

**Development ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-dev
  namespace: development
data:
  ENVIRONMENT: "development"
  DEBUG: "true"
  LOG_LEVEL: "debug"
  DATABASE_URL: "postgresql://localhost:5432/myapp_dev"
```

**Production ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-prod
  namespace: production
data:
  ENVIRONMENT: "production"
  DEBUG: "false"
  LOG_LEVEL: "info"
  DATABASE_URL: "postgresql://prod-db.example.com:5432/myapp"
```

## Best Practices

### ConfigMap Best Practices

1. **Use Descriptive Names**: Choose clear, descriptive names for ConfigMaps
2. **Organize by Component**: Create separate ConfigMaps for different components
3. **Version Control**: Store ConfigMap YAML files in version control
4. **Size Limits**: ConfigMaps are limited to 1MB
5. **Immutability**: Use immutable ConfigMaps for static configuration
6. **Validation**: Validate configuration data before creating ConfigMaps

### Secret Best Practices

1. **Least Privilege**: Only mount secrets where needed
2. **Rotation**: Regularly rotate secrets
3. **Encryption**: Enable encryption at rest for etcd
4. **RBAC**: Use RBAC to control access to secrets
5. **External Secret Management**: Consider external secret management tools
6. **Avoid Logging**: Never log secret values

### General Best Practices

1. **Namespace Organization**: Use namespaces to organize resources
2. **Labels and Annotations**: Use labels and annotations for better organization
3. **Testing**: Test configuration changes in non-production environments
4. **Monitoring**: Monitor for configuration-related issues
5. **Documentation**: Document configuration parameters and their purposes

## Configuration Management Patterns

### Pattern 1: Environment-Specific Overlays

**Base configuration:**
```yaml
# base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  CACHE_SIZE: "100"
```

**Environment-specific overlay:**
```yaml
# overlays/dev/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "debug"
  DEBUG: "true"
```

### Pattern 2: Configuration Hierarchies

**Global configuration:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: global-config
data:
  COMPANY_NAME: "MyCompany"
  TIMEZONE: "UTC"
```

**Application-specific configuration:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_NAME: "web-service"
  PORT: "8080"
```

### Pattern 3: Feature Flags

**Feature flags ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: feature-flags
data:
  ENABLE_NEW_UI: "true"
  ENABLE_BETA_FEATURES: "false"
  MAINTENANCE_MODE: "false"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. ConfigMap/Secret Not Found
**Symptoms:** Pod fails to start with mount errors

**Solution:**
```bash
# Check if ConfigMap exists
kubectl get configmap -n <namespace>

# Check ConfigMap details
kubectl describe configmap <name> -n <namespace>

# Verify namespace
kubectl get pods -o wide
```

#### 2. Permission Denied
**Symptoms:** Cannot access mounted files

**Solution:**
```yaml
# Set proper file permissions
volumes:
- name: config-volume
  configMap:
    name: my-config
    defaultMode: 0644  # or 0755 for directories
```

#### 3. Environment Variables Not Set
**Symptoms:** Environment variables from ConfigMap/Secret are empty

**Solution:**
```bash
# Check pod environment
kubectl exec <pod-name> -- env | grep <VARIABLE_NAME>

# Verify ConfigMap keys
kubectl get configmap <name> -o yaml
```

#### 4. ConfigMap Updates Not Reflected
**Symptoms:** Application still uses old configuration

**Solution:**
- Environment variables are not updated automatically
- Mounted files are updated (with some delay)
- Restart pods to pick up environment variable changes:

```bash
kubectl rollout restart deployment <deployment-name>
```

### Debugging Commands

```bash
# List all ConfigMaps
kubectl get configmaps --all-namespaces

# Show ConfigMap content
kubectl get configmap <name> -o yaml

# Describe ConfigMap
kubectl describe configmap <name>

# List all Secrets
kubectl get secrets --all-namespaces

# Show Secret content (be careful with sensitive data)
kubectl get secret <name> -o yaml

# Check pod environment variables
kubectl exec <pod-name> -- env

# Check mounted files
kubectl exec <pod-name> -- ls -la /path/to/mounted/files

# Check pod events
kubectl describe pod <pod-name>
```

## Advanced Topics

### External Secret Management

#### Using External Secrets Operator
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "my-role"
```

#### Using Sealed Secrets
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# Create sealed secret
echo -n mypassword | kubectl create secret generic mysecret --dry-run=client --from-file=password=/dev/stdin -o yaml | kubeseal -o yaml > mysealedsecret.yaml
```

### Configuration Validation

**ValidatingAdmissionWebhook for ConfigMaps:**
```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionWebhook
metadata:
  name: validate-configmap
webhooks:
- name: configmap.validation.example.com
  clientConfig:
    service:
      name: validation-webhook
      namespace: default
      path: "/validate-configmap"
  rules:
  - operations: ["CREATE", "UPDATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["configmaps"]
```

### Config Hot Reloading

**Using a sidecar container for config reloading:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-reloader
spec:
  containers:
  - name: app
    image: myapp:latest
    volumeMounts:
    - name: config
      mountPath: /etc/config
  
  # Sidecar container for config reloading
  - name: config-reloader
    image: configmap-reload:latest
    args:
    - --volume-dir=/etc/config
    - --webhook-url=http://localhost:8080/reload
    volumeMounts:
    - name: config
      mountPath: /etc/config
  
  volumes:
  - name: config
    configMap:
      name: app-config
```

## Migration and Rollback Strategies

### Rolling Updates with ConfigMaps

1. **Create new ConfigMap version:**
```bash
kubectl create configmap app-config-v2 --from-file=config-v2.yaml
```

2. **Update Deployment to use new ConfigMap:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: app
        envFrom:
        - configMapRef:
            name: app-config-v2  # Updated reference
```

3. **Monitor and rollback if needed:**
```bash
# Rollback deployment
kubectl rollout undo deployment/my-app

# Or update to previous ConfigMap
kubectl patch deployment my-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","envFrom":[{"configMapRef":{"name":"app-config-v1"}}]}]}}}}'
```

## Monitoring and Observability

### Monitoring ConfigMap and Secret Usage

**Custom metrics for ConfigMap usage:**
```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: configmap-exporter
spec:
  selector:
    matchLabels:
      app: configmap-exporter
  endpoints:
  - port: metrics
```

**Alerting on configuration changes:**
```yaml
# Prometheus alert rule
- alert: ConfigMapChanged
  expr: increase(kubernetes_configmap_info[5m]) > 0
  for: 0m
  labels:
    severity: info
  annotations:
    summary: "ConfigMap {{ $labels.configmap }} changed"
```

## Conclusion

ConfigMaps and Secrets are fundamental building blocks for application configuration in Kubernetes. Key takeaways:

1. **Use ConfigMaps for non-sensitive configuration data**
2. **Use Secrets for sensitive information with proper security measures**
3. **Choose the right method (env vars vs volumes) based on your use case**
4. **Follow security best practices, especially for Secrets**
5. **Implement proper configuration management patterns**
6. **Monitor and validate your configuration changes**
7. **Plan for configuration updates and rollbacks**

By mastering these concepts and patterns, you can build more maintainable, secure, and flexible applications in Kubernetes.

---

*Remember: Good configuration management is crucial for application reliability and security!* 🔧🔐