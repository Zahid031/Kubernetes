# Cilium Installation Guide — Helm + GitOps (ArgoCD)

One values file. Checked into Git. ArgoCD reads it from there and keeps the cluster in sync. That's the whole model — no second copy anywhere.

Example cluster name used throughout: **`acme-prod-cluster`** — replace with your own.

---

## The one file that matters

This is the **only** values file in this whole setup. It lives at:

```
gitops-config/clusters/acme-prod-cluster/cilium-values.yaml
```

in your GitOps repo (the repo ArgoCD watches — not the Cilium chart repo, not a local scratch copy).

```yaml
# gitops-config/clusters/acme-prod-cluster/cilium-values.yaml

cluster:
  name: acme-prod-cluster
  id: 1

ipam:
  mode: kubernetes

# See "kubeProxyReplacement explained" below before touching this.
# Start with false — it's the safer default for a first install.
kubeProxyReplacement: false

# Only needed if kubeProxyReplacement is true. Delete these two lines
# entirely while it's false — they do nothing and just add confusion.
# k8sServiceHost: "<YOUR_K8S_API_SERVER_HOST>"
# k8sServicePort: "6443"

hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: true

operator:
  replicas: 2

resources:
  requests:
    cpu: 100m
    memory: 512Mi
  limits:
    cpu: 500m
    memory: 1Gi

prometheus:
  enabled: true
  serviceMonitor:
    enabled: true    # requires the Prometheus Operator CRDs to already exist
```

That's it. Everything else in this guide either installs Cilium using this file (Step 1–3, for testing locally before you commit) or points ArgoCD at this exact file in Git (Step 4).

---

## `kubeProxyReplacement` explained

Kubernetes normally uses **kube-proxy** (running as a DaemonSet, using iptables or ipvs rules) to route traffic to the right pod when something talks to a Service.

- **`false`** (recommended to start): kube-proxy keeps doing that job. Cilium only handles pod-to-pod networking and enforces network policies on top. Cilium doesn't need to know where your API server is, so `k8sServiceHost`/`k8sServicePort` are irrelevant — leave them out.
- **`true`**: Cilium takes over Service routing itself using eBPF, and kube-proxy is no longer needed (you'd typically remove it). Because Cilium is now doing kube-proxy's job, it needs to reach the API server directly — that's what `k8sServiceHost`/`k8sServicePort` are for. This is faster but is a more invasive change to how your cluster routes traffic.

**These are not equally safe to change casually.** Going from `false` to `true` later is a real migration — plan and test it separately, don't treat it as a routine values-file edit.

---

## Prerequisites

- Kubernetes cluster with no CNI installed, or Cilium in CNI-replacement mode
- `helm` v3.12+
- Latest `cilium` CLI (`cilium version --client` to check)
- `kubectl` configured with cluster access
- `jq` (used below to resolve the latest chart version dynamically)
- ArgoCD installed on the cluster, with access to your GitOps repo

---

## Step 1: Resolve the Latest Chart Version

Don't hardcode a version — it goes stale the moment a patch ships:

```bash
helm repo add cilium https://helm.cilium.io/
helm repo update

CILIUM_VERSION=$(helm search repo cilium/cilium --versions -o json \
  | jq -r '[.[] | select(.version | test("-") | not)][0].version')

echo "Latest stable Cilium chart: ${CILIUM_VERSION}"
```

Before installing, also confirm your Kubernetes version is inside Cilium's supported range for that chart version (Cilium publishes a compatibility table per release — version mismatch is one of the most common install failures):

```bash
kubectl version -o json | jq -r '.serverVersion.gitVersion'
```

---

## Step 2: Test Locally Before Committing to Git (optional but recommended)

Point `helm` at the same file you're about to commit — don't write a separate local copy:

```bash
helm upgrade --install cilium cilium/cilium \
  --version "${CILIUM_VERSION}" \
  --namespace kube-system \
  --values gitops-config/clusters/acme-prod-cluster/cilium-values.yaml \
  --wait --atomic --create-namespace
```

If it works, commit that same file to Git. If it doesn't, fix the file and re-test — never fork it into a second version.

---

## Step 3: Validate the Install

```bash
# 1. Cilium's own health check
cilium status --wait --wait-duration 300s

# 2. Every node should have a running agent
EXPECTED_NODES=$(kubectl get nodes --no-headers | wc -l)
READY_AGENTS=$(kubectl get pods -n kube-system -l k8s-app=cilium \
  --field-selector=status.phase=Running --no-headers | wc -l)
echo "Agents running: ${READY_AGENTS}/${EXPECTED_NODES}"

# 3. Hubble relay reachable
kubectl get pods -n kube-system -l k8s-app=hubble-relay

# 4. Real end-to-end proof the CNI works, not just that pods started
cilium connectivity test --timeout 120s
```

---

## Step 4: Hand It Off to ArgoCD

The `Application` below does two things: pulls the **chart** from Cilium's upstream Helm repo, and pulls the **values** from the one file you already tested in Step 2 — in your own GitOps repo.

```yaml
# argocd/cilium-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cilium
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default

  sources:
    - repoURL: https://helm.cilium.io/
      chart: cilium
      targetRevision: "1.19.*"   # auto-adopt patch releases within 1.19; bump manually for a new minor
      helm:
        valueFiles:
          - $values/clusters/acme-prod-cluster/cilium-values.yaml
    - repoURL: https://github.com/your-org/gitops-config.git
      targetRevision: main
      ref: values

  destination:
    server: https://kubernetes.default.svc
    namespace: kube-system

  syncPolicy:
    automated:
      prune: true       # remove anything no longer defined in Git
      selfHeal: true     # revert manual kubectl edits back to what's in Git
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 3
      backoff:
        duration: 30s
        factor: 2
        maxDuration: 5m
```

From here on, changing Cilium's config means: edit `cilium-values.yaml` in Git, open a PR, merge → ArgoCD picks it up within its sync interval and applies it. You never touch the cluster directly for a config change.

```bash
# Check ArgoCD sees it as synced and healthy
argocd app get cilium
```

---

## Best Practices Applied Here

- **One values file, one source of truth** — same file for local testing and for ArgoCD; never fork it.
- **`kubeProxyReplacement: false` to start** — safer first install; flip to `true` later as its own reviewed change, not a routine edit.
- **Never hardcode the chart version** — resolved dynamically at install time, tracked as a wildcard (`1.19.*`) in ArgoCD so patches auto-adopt while minors stay gated behind a PR.
- **Validation means connectivity, not just "pods are Running"** — agent-count check + `cilium connectivity test`, not just `kubectl get pods`.
- **`selfHeal: true`** so drift between the cluster and Git gets corrected automatically — but be aware of this if you're ever debugging live and making manual changes.
