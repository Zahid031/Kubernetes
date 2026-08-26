# Kubernetes Interview Preparation Guide

A complete, layered guide from fundamentals to production troubleshooting — designed for DevOps / SRE / Platform Engineer interviews.

**Recommended study order:**
1. Fundamentals → 2. Networking → 3. Scheduling → 4. Reliability → 5. Internals → 6. Production/Troubleshooting

---

## 1. Kubernetes Fundamentals

### Q1. What is Kubernetes?
Kubernetes is an open-source container orchestration platform used to automate the deployment, scaling, networking, and management of containerized applications.

Key features:
- Container scheduling
- Self-healing
- Service discovery
- Load balancing
- Rolling deployments
- Horizontal/vertical scaling
- Configuration and secret management
- Storage orchestration

### Q2. What is a Kubernetes cluster?
A group of machines running Kubernetes, consisting of:

**Control Plane**
- API Server
- etcd
- Scheduler
- Controller Manager
- Cloud Controller Manager

**Worker Nodes**
- kubelet
- kube-proxy
- Container Runtime
- Pods

### Q3. What are the main components of the control plane?

| Component | Responsibility |
|---|---|
| kube-apiserver | Entry point/API for Kubernetes |
| etcd | Stores cluster state |
| kube-scheduler | Decides which node runs a Pod |
| kube-controller-manager | Runs controllers that maintain desired state |
| cloud-controller-manager | Integrates Kubernetes with cloud providers |

Request flow:
```
kubectl
   |
   v
API Server
   |
   +----> etcd
   |
   +----> Scheduler
   |
   +----> Controllers
             |
             v
         Worker Nodes
```

### Q4. What is etcd?
A distributed key-value database used by Kubernetes to store the cluster's persistent state: Pods, Deployments, Services, ConfigMaps, Secrets, Nodes, RBAC configuration.

> If etcd is lost without a backup, the control plane can lose its knowledge of the cluster state.

### Q5. What is a Pod?
The smallest deployable unit in Kubernetes. A Pod can contain one or more containers that share:
- Network namespace
- IP address
- Ports
- Volumes

Normally one application container runs per Pod; tightly coupled containers (e.g., sidecars) may share a Pod.

### Q6. Why doesn't Kubernetes run containers directly?
Kubernetes manages **Pods**, not individual containers. A Pod provides a common abstraction allowing Kubernetes to manage networking, storage, scheduling, lifecycle, and health checks.

---

## 2. Deployments & ReplicaSets

### Q7. What is a Deployment?
Manages the lifecycle of stateless Pods through ReplicaSets. Provides rolling updates, rollbacks, replica management, and declarative configuration.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

### Q8. What is a ReplicaSet?
Ensures a specified number of identical Pods are running (e.g., `replicas: 3` → 3 matching Pods maintained). A Deployment normally creates and manages ReplicaSets rather than you managing Pods directly.

### Q9. Deployment vs ReplicaSet?
- **ReplicaSet:** Maintains the desired number of Pods.
- **Deployment:** Manages ReplicaSets, provides rolling updates, supports rollback, manages application versions.

In practice, you use a Deployment rather than creating a ReplicaSet directly.

### Q10. What happens when you update a Deployment image?
```
kubectl set image deployment/api api=myapp:v2
```
The Deployment creates a new ReplicaSet with `v2`, then gradually scales the old ReplicaSet down while scaling the new one up:

```
Old ReplicaSet
      |
      | scale down
      v

New ReplicaSet
      |
      | scale up
      v

New Pods
```

Controlled by:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 25%
    maxSurge: 25%
```

---

## 3. Services & Networking

### Q11. Why do we need a Service?
Pods are ephemeral — their IPs can change. A Service provides a stable virtual IP/DNS name and routes traffic to matching Pods.

```
Client
  |
  v
Service
  |
  +----> Pod
  +----> Pod
  +----> Pod
```

### Q12. What are the Service types?
- **ClusterIP** — default, internal cluster access only
- **NodePort** — exposes a port on every node
- **LoadBalancer** — usually provisions a cloud load balancer
- **ExternalName** — maps a Service to an external DNS name

### Q13. ClusterIP vs NodePort vs LoadBalancer?
```
ClusterIP   --> Internal only

NodePort    --> NodeIP:Port --> Service --> Pods

LoadBalancer --> Cloud LB --> Service --> Pods
```

Typical cloud production path:
```
Internet
   |
   v
AWS ALB/NLB
   |
   v
Ingress / Gateway
   |
   v
Kubernetes Service
   |
   v
Pods
```

### Q14. What is kube-proxy?
Runs on worker nodes and implements Service networking by programming rules (commonly via iptables or IPVS) so traffic sent to a Service reaches the right backend Pods.

### Q15. What is CoreDNS?
Provides DNS-based service discovery inside Kubernetes. A fully qualified Service name looks like:
```
payment-service.production.svc.cluster.local
```

---

## 4. Scheduling

### Q16. How does the Scheduler decide which node runs a Pod?
It evaluates nodes based on:
- CPU/memory requests
- Node selectors
- Affinity/anti-affinity
- Taints/tolerations
- Topology constraints
- Node availability
- Scheduling policies

Then selects an appropriate node; the kubelet on that node starts the Pod.

### Q17. nodeSelector vs node affinity vs taints/tolerations?

**nodeSelector** (simple):
```yaml
nodeSelector:
  workload: backend
```

**Node affinity** (more expressive):
```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: workload
              operator: In
              values:
                - backend
```

**Taints and tolerations** — a taint repels Pods:
```
kubectl taint nodes node1 workload=database:NoSchedule
```
A Pod needs a matching toleration to be scheduled there.

---

## 5. Resources

### Q18. Requests vs Limits?
- **Request** = resources Kubernetes reserves for scheduling.
- **Limit** = maximum resources the container is allowed to consume.

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1"
    memory: "1Gi"
```

### Q19. What happens when a container exceeds its memory limit?
It can be terminated by the kernel (OOM kill). `kubectl describe pod <pod>` may show `Reason: OOMKilled`. CPU behaves differently — exceeding a CPU limit causes throttling, not termination.

### Q20. What is QoS in Kubernetes?
Three QoS classes: **Guaranteed**, **Burstable**, **BestEffort**. E.g., a Pod where every container has equal CPU/memory requests and limits is Guaranteed. QoS affects eviction order under node resource pressure.

---

## 6. ConfigMaps & Secrets

### Q21. ConfigMap vs Secret?
- **ConfigMap** — non-sensitive config (e.g., `DATABASE_HOST`, `LOG_LEVEL`, `APP_PORT`)
- **Secret** — sensitive data (e.g., `DATABASE_PASSWORD`, `API_TOKEN`, `TLS_PRIVATE_KEY`)

> Kubernetes Secrets aren't automatically encrypted — protection depends on cluster/etcd configuration. In production, consider AWS Secrets Manager or HashiCorp Vault.

---

## 7. Probes

### Q22. Liveness, readiness, and startup probes?
- **Liveness** — "Is this container still healthy?" Repeated failure → container restart.
- **Readiness** — "Can this Pod receive traffic?" Failure → removed from Service endpoints (not restarted).
- **Startup** — "Has this slow-starting app finished starting?" Prevents premature liveness/readiness kills.

### Q23. Readiness vs Liveness — example
If a Pod can't reach its database:

**Readiness fails:**
```
Pod
 |
 X  <-- removed from Service endpoints (Pod stays alive)
```

**Liveness fails:**
```
Pod
 |
 X
 |
Restart container
```

> **Readiness controls traffic. Liveness controls restarts.**

---

## 8. Storage

### Q24. What is a PersistentVolume?
A **PersistentVolume (PV)** represents cluster storage. A **PersistentVolumeClaim (PVC)** is an application's request for storage.

```
Pod --> PVC --> PV --> Storage
```

### Q25. What is a StorageClass?
Defines how storage is dynamically provisioned. Example (AWS):
```
PVC --> StorageClass --> EBS CSI Driver --> EBS Volume
```

---

## 9. Ingress

### Q26. What is Ingress?
An API object defining HTTP/HTTPS routing rules, requiring an Ingress Controller to implement them (e.g., AWS Load Balancer Controller, NGINX, Traefik).

```
api.example.com
      |
      v
Ingress
      |
      +----> api-service
      +----> auth-service
```

### Q27. Ingress vs Service?
- **Service** — stable networking to Pods
- **Ingress** — HTTP/HTTPS routing to Services

```
Internet --> Ingress --> Service A --> Pods
                     --> Service B --> Pods
```

---

## 10. Controllers

### Q28. What is a Kubernetes Controller?
Continuously compares **Desired State** vs **Current State** and acts to reconcile them. E.g., if a replica dies (desired=3, current=2), the controller creates a new Pod (desired=3, current=3).

---

## 11. StatefulSet vs Deployment

### Q29. Deployment vs StatefulSet?

| Deployment | StatefulSet |
|---|---|
| Stateless applications | Stateful applications |
| Pods are interchangeable | Pods have stable identities |
| Random Pod names | Stable names (e.g., `postgres-0`, `postgres-1`) |
| Usually shared/external storage | Stable storage per Pod |
| Web/API services | Databases, Kafka, etc. |

---

## 12. DaemonSet

### Q30. What is a DaemonSet?
Ensures a Pod runs on every eligible node. Common uses: log collectors, node exporters, security agents, network agents, monitoring agents.

---

## 13. Jobs & CronJobs

### Q31. Job vs CronJob?
- **Job** — runs a task until it successfully completes.
- **CronJob** — creates Jobs on a schedule, e.g. `schedule: "0 2 * * *"` (daily backup at 2 AM).

---

## 14. Rolling Updates

### Q32. What is a rolling deployment?
Gradually replaces old Pods with new ones without downtime:
```
v1 v1 v1 → v2 v1 v1 → v2 v2 v1 → v2 v2 v2
```

### Q33. maxSurge vs maxUnavailable?
```yaml
rollingUpdate:
  maxSurge: 1
  maxUnavailable: 0
```
- **maxSurge** — max Pods allowed above desired replica count during update.
- **maxUnavailable** — max Pods allowed unavailable during update.

`maxUnavailable: 0` ensures capacity isn't intentionally reduced during rollout (given sufficient cluster resources).

---

## 15. Troubleshooting (High-Value for DevOps Interviews)

### Q34. A Pod is stuck in `Pending`. How do you troubleshoot?
```
kubectl get pods
kubectl describe pod <pod>
```
Check the **Events** section. Common causes:
- Insufficient CPU/memory
- Node selector mismatch
- Affinity rules
- Taints
- Missing PVC
- Resource quota
- Scheduling constraints

Then check cluster capacity:
```
kubectl get nodes
kubectl describe node <node>
```

### Q35. Pod is in `CrashLoopBackOff`. What do you check?
```
kubectl get pod <pod>
kubectl describe pod <pod>
kubectl logs <pod>
kubectl logs <pod> --previous
```
Investigate: application logs, exit code, environment variables, ConfigMaps, Secrets, database connectivity, dependency availability, liveness probe, OOMKilled, container command/args.

### Q36. Pod is `Running` but the application isn't reachable. What do you check?
Troubleshoot layer by layer:
```
Client → Load Balancer → Ingress → Service → Endpoints → Pod → Container
```
```
kubectl get ingress
kubectl describe ingress <name>
kubectl get svc
kubectl describe svc <name>
kubectl get endpoints <service>
kubectl get pods -o wide
kubectl port-forward svc/my-service 8080:80
```
If direct port-forward access works, the issue is likely in the external networking/Ingress path.

---

## 16. Advanced Kubernetes

### Q37. What is HPA?
Horizontal Pod Autoscaler automatically changes replica count based on metrics.
```
kubectl autoscale deployment api --min=3 --max=10 --cpu-percent=70
```

### Q38. HPA vs VPA vs Cluster Autoscaler?

| Component | Changes |
|---|---|
| HPA | Number of Pods |
| VPA | Pod resource requests/limits |
| Cluster Autoscaler | Number of nodes |

Flow example:
```
High traffic → HPA → More Pods → Not enough node capacity
   → Cluster Autoscaler / Karpenter → More Nodes
```

### Q39. What is Karpenter?
A node provisioning system that automatically provisions right-sized compute based on unschedulable Pods and scheduling requirements — more flexible instance selection than traditional Cluster Autoscaler.

```
Traffic increases → HPA creates more Pods → Pods Pending
   → Karpenter detects requirements → Creates suitable EC2 instances
   → Pods get scheduled
```

---

## 17. Security

### Q40. What is RBAC?
Role-Based Access Control — controls **who** can perform **what action** on **which resource**. Objects: `Role`, `ClusterRole`, `RoleBinding`, `ClusterRoleBinding`.

```yaml
kind: Role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
```

### Q41. Role vs ClusterRole?
- **Role** — namespace-scoped
- **ClusterRole** — cluster-scoped, usable across namespaces

---

## 18. Production Scenario Questions

### Q42. Your production API suddenly gets 10x traffic. What happens?
First, check SLIs/infra metrics: request rate, latency, errors, CPU, memory, downstream saturation.

```
Traffic increases → Pods consume more resources → HPA detects increase
   → More Pods created → Node capacity decreases → Pods may go Pending
   → Karpenter/Cluster Autoscaler adds nodes → Pods schedule
   → Service distributes traffic
```

Also check: database capacity, Redis, Kafka, external APIs, connection pools, load balancer, error rate, p95/p99 latency, saturation.

> This demonstrates SRE thinking rather than just "HPA will scale it."

### Q43. A node suddenly goes down. What happens?
Kubernetes detects the node as unhealthy; Pods on it become unavailable. Deployment/ReplicaSet controllers recreate replicas elsewhere (given sufficient capacity).

```
Before:
Node 1 → Pod A
Node 2 → Pod B
Node 3 → Pod C

Node 2 DOWN

After:
Node 1 → Pod A
Node 3 → Pod C
Node 1/3 → New Pod B
```

For production HA, also consider: multiple AZs, pod anti-affinity, topology spread constraints, PodDisruptionBudgets, sufficient node capacity.

### Q44. 10 replicas but all Pods on one node — is this good?
No — if that node fails, all replicas can disappear together. Use `topologySpreadConstraints` or `podAntiAffinity` to spread replicas across nodes/AZs:
```
AZ-A       AZ-B       AZ-C
Pod 1      Pod 2      Pod 3
Pod 4      Pod 5      Pod 6
```

### Q45. How would you deploy Kubernetes in production?
```
                    Internet
                       |
                 Cloudflare
                       |
                    AWS ALB
                       |
                  API Gateway
                       |
                Kubernetes
                       |
        +--------------+--------------+
        |              |              |
      AZ-A            AZ-B           AZ-C
        |              |              |
      Nodes           Nodes          Nodes
        |              |              |
      Pods            Pods           Pods
```

Implement:
- Multi-AZ architecture
- Private worker nodes
- IAM least privilege
- RBAC
- Network policies
- Secrets management
- Resource requests/limits
- HPA
- Karpenter/Cluster Autoscaler
- PodDisruptionBudgets
- Topology spread
- Liveness/readiness/startup probes
- Centralized logging
- Metrics
- Distributed tracing
- Alerting
- Backup/restore
- Disaster recovery
- GitOps/IaC
- Regular Kubernetes upgrades

---

## 19. Deep-Dive Questions (Mid/Senior Level — Don't Just Memorize Definitions)

Be ready to *explain the mechanics*, not just define terms:

- [ ] How does a Kubernetes request travel from `kubectl` to a Pod?
- [ ] How does Kubernetes scheduling actually work internally?
- [ ] How does Service networking work?
- [ ] How does CoreDNS resolve a Service?
- [ ] What happens when a Pod dies?
- [ ] What happens when a node dies?
- [ ] How does a Deployment perform a rolling update?
- [ ] How does HPA calculate scaling?
- [ ] How does Karpenter decide what instance to provision?
- [ ] How does Kubernetes authentication and authorization work?
- [ ] How does kubelet communicate with the API server?
- [ ] How does Kubernetes maintain desired state?
- [ ] What happens internally when you run `kubectl apply`?
- [ ] How does Kubernetes networking work between Pods?
- [ ] How does the CNI assign Pod IPs?
- [ ] What happens when CoreDNS goes down?
- [ ] What happens when etcd goes down?
- [ ] How would you upgrade a production cluster?
- [ ] How would you perform Kubernetes disaster recovery?
- [ ] How would you debug a production latency spike?

---

## 20. Pod Lifecycle & Multi-Container Patterns

### Q46. What are the phases of a Pod's lifecycle?
`Pending` → `Running` → `Succeeded`/`Failed`, with `Unknown` if the node can't be reached.

```
Pending
   |  (image pull, scheduling)
   v
Running
   |
   +--> Succeeded (all containers exit 0, e.g. Job)
   +--> Failed (a container exited non-zero)
```
Container-level states inside a Pod: `Waiting`, `Running`, `Terminated`.

### Q47. What is an Init Container?
A container that runs to completion **before** app containers start. Used for setup tasks — waiting for a dependency, running migrations, fetching config.

```yaml
initContainers:
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c', 'until nc -z db 5432; do sleep 2; done']
```
Init containers run sequentially; if one fails, the Pod restarts them per its `restartPolicy`.

### Q48. What are common multi-container Pod patterns?
- **Sidecar** — helper container extending the main app (e.g., log shipper, Envoy proxy). Runs alongside, shares volume/network.
- **Ambassador** — proxies network connections from the main container to the outside world (e.g., a local proxy to a remote DB).
- **Adapter** — standardizes/transforms output from the main container (e.g., normalizing logs/metrics format for monitoring).

### Q49. What is a static Pod?
A Pod managed directly by the **kubelet** on a specific node (not via the API server/scheduler), defined by a manifest file in a watched directory (e.g., `/etc/kubernetes/manifests`). The kubelet creates a mirror Pod in the API server for visibility. Control plane components (`kube-apiserver`, `etcd`, `scheduler`) are often run this way in kubeadm clusters.

---

## 21. Network Policies

### Q50. What is a NetworkPolicy?
A namespaced resource that controls traffic flow at the IP/port level between Pods (like a firewall for Pods). By default, all Pods can talk to all Pods — a NetworkPolicy restricts this.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 8080
```

> Requires a CNI plugin that supports NetworkPolicy enforcement (e.g., Calico, Cilium) — not all CNIs do (e.g., basic flannel doesn't).

### Q51. Default-deny vs default-allow?
By default Kubernetes is **default-allow** (all Pods can reach all Pods). A common production hardening step is a default-deny policy per namespace, then explicitly allowing needed traffic:
```yaml
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
```
(empty `podSelector` + no rules = deny all)

---

## 22. Admission Control

### Q52. What is an Admission Controller?
A piece of code that intercepts requests to the API server **after authentication/authorization but before persistence to etcd**. Can mutate (`MutatingAdmissionWebhook`) or validate (`ValidatingAdmissionWebhook`) objects.

```
kubectl apply
     |
     v
Authentication
     |
     v
Authorization (RBAC)
     |
     v
Admission Controllers (Mutating → Validating)
     |
     v
etcd
```
Examples: `NamespaceLifecycle`, `ResourceQuota`, `PodSecurity`, custom webhooks (e.g., OPA Gatekeeper, Kyverno) that enforce policies like "no `:latest` tag" or "must have resource limits."

---

## 23. Custom Resource Definitions & Operators

### Q53. What is a CRD (Custom Resource Definition)?
A way to extend the Kubernetes API with your own resource types beyond the built-ins (Pods, Services, etc.). Once registered, custom resources behave like native ones (`kubectl get`, RBAC, etc. all work).

### Q54. What is an Operator?
A CRD **plus** a custom controller that encodes operational knowledge to manage a complex application's full lifecycle (deploy, backup, upgrade, failover) — not just its running state. Example: a PostgreSQL Operator that handles backups, failover, and version upgrades automatically, reacting to a `Postgres` custom resource the way a human DBA would.

```
Custom Resource (desired state, e.g. "Postgres cluster with 3 replicas")
        |
        v
   Operator (controller)
        |
        v
  Creates/manages StatefulSets, Services, Secrets, backups...
```

---

## 24. Security Contexts & Pod Security

### Q55. What is a SecurityContext?
Defines privilege and access control settings for a Pod or container — user/group ID, privilege escalation, read-only root filesystem, Linux capabilities.

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
```

### Q56. What are Pod Security Standards / Pod Security Admission?
The built-in replacement for the deprecated PodSecurityPolicy. Defines three levels enforced per-namespace via labels:
- **Privileged** — unrestricted
- **Baseline** — blocks known privilege escalations
- **Restricted** — heavily hardened (non-root, no host access, dropped capabilities)

```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
```

---

## 25. Resource Governance

### Q57. ResourceQuota vs LimitRange?
- **ResourceQuota** — caps total resource consumption (CPU, memory, object counts) **per namespace**.
- **LimitRange** — sets default/min/max resource requests and limits **per Pod/container** within a namespace (so users can't omit requests/limits or request absurd amounts).

```yaml
# ResourceQuota — namespace-wide cap
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    pods: "50"
```
```yaml
# LimitRange — per-container defaults
spec:
  limits:
    - default:
        cpu: 500m
      defaultRequest:
        cpu: 250m
      type: Container
```

### Q58. What is a PodDisruptionBudget (PDB)?
Limits how many Pods of a set can be voluntarily disrupted at once (during node drains, cluster upgrades, etc.) — protects availability without preventing involuntary disruptions like a node crash.
```yaml
spec:
  minAvailable: 2      # or maxUnavailable: 1
  selector:
    matchLabels:
      app: api
```

---

## 26. Labels, Selectors & Annotations

### Q59. Labels vs Annotations?
- **Labels** — key/value pairs used to **identify and select** objects (e.g., Services select Pods by label). Small, structured, queryable.
- **Annotations** — arbitrary metadata **not used for selection** — build info, contact details, tool-specific config (e.g., Ingress controller hints).

### Q60. Equality-based vs set-based selectors?
```yaml
# Equality-based
selector:
  app: frontend
```
```yaml
# Set-based (used in Deployments/ReplicaSets matchExpressions)
matchExpressions:
  - key: env
    operator: In
    values: ["prod", "staging"]
```

---

## 27. Networking Internals

### Q61. How does the CNI assign Pod IPs?
When the kubelet creates a Pod, it calls the configured **CNI plugin** (Calico, Cilium, AWS VPC CNI, etc.), which:
1. Creates a network namespace for the Pod
2. Assigns an IP from the cluster's Pod CIDR (or VPC, for AWS VPC CNI)
3. Sets up virtual ethernet pairs / routes so the Pod can reach other Pods and the outside world

Every Pod gets its own unique IP (the "IP-per-Pod" model) — no NAT needed between Pods on the same cluster.

### Q62. What is the difference between Endpoints and EndpointSlices?
Both track which Pod IPs back a Service. **EndpointSlices** are the newer, more scalable replacement — they shard endpoints across multiple objects instead of one giant `Endpoints` object, which matters a lot for Services with thousands of backing Pods.

### Q63. What happens when CoreDNS goes down?
New DNS lookups inside the cluster fail — Pods can't resolve Service names (though existing cached connections may keep working). This cascades: apps that do dynamic service discovery start failing to reach dependencies. CoreDNS should always run with multiple replicas and its own PDB/HPA.

---

## 28. `kubectl apply` Internals & Cluster Upgrades

### Q64. What actually happens when you run `kubectl apply`?
1. `kubectl` computes a diff (3-way merge: last-applied-config annotation, live object, and your new manifest).
2. Sends a `PATCH` (or `POST` if it doesn't exist) to the API server.
3. Request passes through authentication → authorization (RBAC) → admission controllers.
4. Validated object is persisted to **etcd**.
5. Relevant **controllers** notice the change (via watch) and reconcile actual state toward it.
6. **Scheduler** assigns any new Pods to nodes; **kubelet** on that node pulls images and starts containers.

> "Server-side apply" is the newer approach where the API server itself manages field ownership/merging, instead of `kubectl` doing a local 3-way merge — it avoids conflicts when multiple tools/people manage the same object.

### Q65. How would you upgrade a production Kubernetes cluster?
1. Read the release notes for deprecated/removed APIs (`kubectl deprecations`, `pluto`, `kubent`).
2. Back up etcd.
3. Upgrade the control plane first (API server → controller-manager/scheduler → etcd, per version skew policy — kubelets can be up to 2 minor versions behind the control plane).
4. Upgrade worker nodes: drain → upgrade kubelet/kube-proxy → uncordon, node by node or in batches, respecting PodDisruptionBudgets.
5. Validate workloads, then move to the next batch.
6. Typically done one minor version at a time (e.g., 1.28 → 1.29 → 1.30), never skipping versions.

---

## 29. Service Mesh (Bonus / Senior-Level)

### Q66. What problem does a Service Mesh solve?
A dedicated infrastructure layer (e.g., **Istio**, **Linkerd**) that handles service-to-service communication concerns outside the application code: mutual TLS, retries, circuit breaking, traffic splitting/canary routing, and fine-grained observability (latency, error rate per service pair). Typically implemented via a sidecar proxy (e.g., Envoy) injected into every Pod.

```
Pod A                     Pod B
 App --> Envoy sidecar --> Envoy sidecar --> App
              |                  |
              +--- mTLS, retries, metrics ---+
```
Trade-off: adds latency, resource overhead, and operational complexity — so it's usually adopted once the number of services/traffic patterns is complex enough to justify it.

---

## 30. Behavioral / Scenario-Style Questions to Rehearse

These test judgment, not just recall — practice narrating your **reasoning process**, not just the final answer:

- "Walk me through debugging a service that returns intermittent 502s."
- "A deployment rollout is stuck halfway — how do you decide whether to wait, roll back, or investigate?"
- "How do you decide resource requests/limits for a new service with no historical data?"
- "Your team wants zero-downtime deployments — what has to be true across the app, probes, and Deployment strategy for that to actually hold?"
- "How would you reduce Kubernetes cluster costs without hurting reliability?"
- "Describe a Kubernetes incident you handled — what was the root cause, and what would prevent it from recurring?"
- "How do you approach multi-tenancy in a shared cluster (namespaces, quotas, network policies, RBAC)?"

---

## kubectl Command Cheat Sheet

```bash
# Inspect
kubectl get pods -o wide
kubectl get all -n <namespace>
kubectl describe pod <pod>
kubectl logs <pod> [-c container] [--previous] [-f]
kubectl get events --sort-by=.lastTimestamp

# Debug
kubectl exec -it <pod> -- /bin/sh
kubectl port-forward svc/<service> 8080:80
kubectl debug <pod> -it --image=busybox   # ephemeral debug container
kubectl top pod / kubectl top node        # requires metrics-server

# Apply / rollout
kubectl apply -f manifest.yaml
kubectl rollout status deployment/<name>
kubectl rollout history deployment/<name>
kubectl rollout undo deployment/<name> [--to-revision=N]
kubectl scale deployment/<name> --replicas=5

# Context & RBAC
kubectl config get-contexts / use-context <ctx>
kubectl auth can-i delete pods --as=<user> -n <namespace>

# Cluster health
kubectl get nodes -o wide
kubectl describe node <node>
kubectl get componentstatuses   # deprecated but still seen
```

---

## Study Roadmap

| Level | Topics |
|---|---|
| **1 — Fundamentals** | Pod → Node → Cluster → Deployment → ReplicaSet → Service → ConfigMap → Secret |
| **2 — Networking** | CNI → kube-proxy → CoreDNS → Service → Ingress → Load Balancer |
| **3 — Scheduling** | Requests/limits → Scheduler → Affinity → Taints/Tolerations → Topology spread |
| **4 — Reliability** | Probes → PDB → HPA → VPA → Karpenter → Multi-AZ |
| **5 — Internals** | API Server → etcd → Controllers → Scheduler → kubelet → Reconciliation loop |
| **6 — Production** | Troubleshooting → Upgrades → Security → Observability → DR → Cost optimization |
| **7 — Extensibility & Governance** | Network Policies → Admission Control → CRDs/Operators → Security Contexts → Resource Quotas → PDBs |
| **8 — Senior/Staff Signal** | `kubectl apply` internals → Cluster upgrades → Service Mesh → Behavioral/scenario reasoning |

> For experienced candidates, **Levels 5–8** are where you differentiate yourself from candidates who only know `kubectl` commands. Interviewers at senior levels care less about definitions and more about **why** a mechanism exists and **what breaks** if it's misconfigured — practice explaining trade-offs out loud, not just reciting facts.
