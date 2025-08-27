# Kubernetes Pod and Container Configuration and Monitoring

This repository contains a collection of Kubernetes YAML files and guides demonstrating various aspects of pod and container configuration, health monitoring, and resource management.

## Table of Contents

- [Kubernetes Application Configuration: ConfigMaps and Secrets](#kubernetes-application-configuration-configmaps-and-secrets)
- [Container Health Monitoring](#container-health-monitoring)
- [Managing Container Resources](#managing-container-resources)
- [Init Containers](#init-containers)
- [Self-Healing Pods and Restart Policies](#self-healing-pods-and-restart-policies)
- [File Descriptions](#file-descriptions)

---

## Kubernetes Application Configuration: ConfigMaps and Secrets

This section covers how to manage application configuration using ConfigMaps for non-sensitive data and Secrets for sensitive data.

### Key Concepts:

- **ConfigMaps**: Store non-sensitive data in key-value pairs, allowing you to decouple configuration from your application code.
- **Secrets**: Store sensitive data like passwords, API keys, and tokens.

### Related Files:

- `k8s_config_secrets_guide.md`: A comprehensive guide to using ConfigMaps and Secrets in Kubernetes.
- `example-configMap.yml`: Demonstrates how to create a ConfigMap with both property-like and file-like keys.
- `example-posix-configMap.yml`: Shows a POSIX-compliant ConfigMap.
- `example-secrect.yml`: An example of creating a Secret with base64 encoded data.
- `configmap-env-demo.yml`: A Pod that consumes ConfigMap and Secret data as environment variables.
- `configmap-posix-demo.yml`: A Pod that consumes a POSIX-compliant ConfigMap.
- `configmap-vol-demo.yml`: A Pod that mounts ConfigMap and Secret data as volumes.
- `nginx-pod.yml`: A Pod that uses a ConfigMap for the NGINX configuration and a Secret for htpasswd authentication.
- `nginx.conf`: The NGINX configuration file used in `nginx-pod.yml`.

---

## Container Health Monitoring

This section explains how to use liveness, readiness, and startup probes to monitor the health of your containers.

### Key Concepts:

- **Liveness Probe**: Checks if a container is running. If the probe fails, the container is restarted.
- **Readiness Probe**: Checks if a container is ready to accept traffic. If the probe fails, the container is removed from the service endpoints.
- **Startup Probe**: Checks if a container has started successfully. If the probe fails, the container is restarted.

### Related Files:

- `k8s_container_health_monitoring.md`: A detailed guide on container health monitoring with probes.
- `liveness-hc.yml`: Examples of liveness probes using both `exec` and `httpGet`.
- `readiness-hc.yml`: An example of a Pod with both liveness and readiness probes.
- `startup-hc.yml`: A Pod that uses a startup probe to allow for a slow-starting container.

---

## Managing Container Resources

This section covers how to manage container resources using resource requests and limits.

### Key Concepts:

- **Resource Requests**: The minimum amount of resources that a container needs.
- **Resource Limits**: The maximum amount of resources that a container can use.

### Related Files:

- `k8s_container_resources.md`: A guide to managing container resources in Kubernetes.
- `request_limit.yml`: Examples of Pods with resource requests.
- `resource_limit.yml`: An example of a Pod with both resource requests and limits.

---

## Init Containers

This section explains how to use init containers to perform setup tasks before the main application container starts.

### Key Concepts:

- **Init Containers**: Special containers that run to completion before the main containers are started.

### Related Files:

- `k8s_init_containers.md`: A comprehensive guide to using init containers.
- `init-container.yml`: A Pod that uses init containers to wait for services to be available.
- `initContainer-dependency-service.yml`: The services that the `init-container.yml` Pod depends on.
- `multi-container.yml`: A Pod with two containers that share a volume. One container writes to the volume, and the other reads from it.

---

## Self-Healing Pods and Restart Policies

This section covers how Kubernetes can automatically restart failed containers and how to configure restart policies.

### Key Concepts:

- **Restart Policies**: Control when and how Kubernetes restarts containers. The available policies are `Always`, `OnFailure`, and `Never`.

### Related Files:

- `k8s_self_healing_pods.md`: A guide to self-healing pods and restart policies.
- `restartPolicies.yml`: Examples of Pods with different restart policies.

---

## File Descriptions

| File | Description |
|---|---|
| `configmap-env-demo.yml` | A Pod that consumes ConfigMap and Secret data as environment variables. |
| `configmap-posix-demo.yml` | A Pod that consumes a POSIX-compliant ConfigMap. |
| `configmap-vol-demo.yml` | A Pod that mounts ConfigMap and Secret data as volumes. |
| `example-configMap.yml` | Demonstrates how to create a ConfigMap with both property-like and file-like keys. |
| `example-posix-configMap.yml` | Shows a POSIX-compliant ConfigMap. |
| `example-secrect.yml` | An example of creating a Secret with base64 encoded data. |
| `init-container.yml` | A Pod that uses init containers to wait for services to be available. |
| `initContainer-dependency-service.yml` | The services that the `init-container.yml` Pod depends on. |
| `k8s_config_secrets_guide.md` | A comprehensive guide to using ConfigMaps and Secrets in Kubernetes. |
| `k8s_container_health_monitoring.md` | A detailed guide on container health monitoring with probes. |
| `k8s_container_resources.md` | A guide to managing container resources in Kubernetes. |
| `k8s_init_containers.md` | A comprehensive guide to using init containers. |
| `k8s_self_healing_pods.md` | A guide to self-healing pods and restart policies. |
| `liveness-hc.yml` | Examples of liveness probes using both `exec` and `httpGet`. |
| `multi-container.yml` | A Pod with two containers that share a volume. One container writes to the volume, and the other reads from it. |
| `nginx-pod.yml` | A Pod that uses a ConfigMap for the NGINX configuration and a Secret for htpasswd authentication. |
| `nginx.conf` | The NGINX configuration file used in `nginx-pod.yml`. |
| `readiness-hc.yml` | An example of a Pod with both liveness and readiness probes. |
| `request_limit.yml` | Examples of Pods with resource requests. |
| `resource_limit.yml` | An example of a Pod with both resource requests and limits. |
| `restartPolicies.yml` | Examples of Pods with different restart policies. |
| `startup-hc.yml` | A Pod that uses a startup probe to allow for a slow-starting container. |
