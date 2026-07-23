# Installing Linkerd (2026) via GitOps

Step-by-step guide for installing an open-source, production-grade Linkerd
control plane through GitOps (Argo CD shown; Flux notes at the bottom).

## Background

As of Feb 2024, the Linkerd open source project itself only ships **edge**
release artifacts. Production-grade **stable** builds are provided by the
vendor community — the free one most people use is **Buoyant Community
Edition**. Latest at time of writing is **Linkerd 2.20** (announced
June 23, 2026 — rate-limit-aware load balancing, reduced memory usage,
better inbound metrics). Chart versions get bumped often, so confirm the
exact latest chart version before pinning it in Git (Step 1).

## Prerequisites

- Argo CD (or Flux) already running in the cluster
- `kubectl` and `helm` CLI access to the cluster for the one-time checks below
- cert-manager, if not already installed (Step 3 installs it via GitOps if needed)

---

## Step 1 — Confirm the latest chart versions

```bash
helm repo add linkerd https://helm.linkerd.io/stable
helm repo update
helm search repo linkerd --versions | head -20
```

Note the `linkerd-crds` and `linkerd-control-plane` chart versions — use
those in the Argo CD `Application` manifests below instead of guessing.

## Step 2 — Check Gateway API CRDs

Linkerd 2.20 configures policy and routing through Gateway API CRDs.

```bash
kubectl get crd gatewayclasses.gateway.networking.k8s.io
# if missing:
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/latest/download/standard-install.yaml
```

Do this as its own GitOps-managed manifest too, not a one-off `kubectl
apply` — but run it manually first to unblock the rest.

## Step 3 — Install cert-manager + trust-manager

GitOps-managed, not `step certificate create` output committed to Git. Skip
this if cert-manager is already running in the cluster.

```yaml
# cert-manager-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cert-manager
  namespace: argocd
  annotations: { argocd.argoproj.io/sync-wave: "0" }
spec:
  project: default
  source:
    repoURL: https://charts.jetstack.io
    chart: cert-manager
    targetRevision: "v1.16.2"   # check latest before pinning
    helm:
      values: |
        crds:
          enabled: true
  destination:
    server: https://kubernetes.default.svc
    namespace: cert-manager
  syncPolicy:
    automated: { prune: true, selfHeal: true }
    syncOptions: [CreateNamespace=true]
```

## Step 4 — Declare the trust anchor + issuer as cert-manager resources

These are just CRDs — safe to commit to Git, no private key material in
the YAML itself.

```yaml
# linkerd-identity-certs.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: linkerd-trust-anchor-issuer
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: linkerd-trust-anchor
  namespace: cert-manager
spec:
  secretName: linkerd-trust-anchor
  isCA: true
  commonName: root.linkerd.cluster.local
  duration: 87600h   # 10 years
  privateKey: { algorithm: ECDSA }
  issuerRef: { name: linkerd-trust-anchor-issuer, kind: ClusterIssuer }
---
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: linkerd-identity-issuer
  namespace: linkerd
spec:
  ca: { secretName: linkerd-trust-anchor }
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: linkerd-identity-issuer
  namespace: linkerd
spec:
  secretName: linkerd-identity-issuer
  isCA: true
  commonName: identity.linkerd.cluster.local
  duration: 48h
  renewBefore: 25h
  privateKey: { algorithm: ECDSA }
  issuerRef: { name: linkerd-identity-issuer, kind: Issuer }
```

This is what makes it GitOps-safe: cert-manager auto-renews the
short-lived issuer cert (48h, matching Linkerd's own default rotation)
without anyone touching Git.

## Step 5 — Argo CD Application for `linkerd-crds`

Must land before the control plane.

```yaml
# linkerd-crds-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: linkerd-crds
  namespace: argocd
  annotations: { argocd.argoproj.io/sync-wave: "1" }
spec:
  project: default
  source:
    repoURL: https://helm.linkerd.io/stable
    chart: linkerd-crds
    targetRevision: "1.8.0"   # replace with what Step 1 showed
  destination:
    server: https://kubernetes.default.svc
    namespace: linkerd
  syncPolicy:
    automated: { prune: true, selfHeal: true }
    syncOptions: [CreateNamespace=true]
```

## Step 6 — Argo CD Application for `linkerd-control-plane`

Wired to the cert-manager secret from Step 4.

```yaml
# linkerd-control-plane-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: linkerd-control-plane
  namespace: argocd
  annotations: { argocd.argoproj.io/sync-wave: "2" }
spec:
  project: default
  source:
    repoURL: https://helm.linkerd.io/stable
    chart: linkerd-control-plane
    targetRevision: "1.16.11"   # replace with what Step 1 showed
    helm:
      values: |
        identityTrustAnchorsPEM: ""   # left blank; identity.externalCA below takes over
        identity:
          externalCA: true
          issuer:
            scheme: kubernetes.io/tls
  destination:
    server: https://kubernetes.default.svc
    namespace: linkerd
  syncPolicy:
    automated: { prune: true, selfHeal: true }
```

`identity.externalCA: true` tells Linkerd to read the
`linkerd-identity-issuer` secret cert-manager already created in Step 4,
instead of expecting a PEM inline in values.

## Step 7 — Commit and sync

```bash
git add cert-manager-app.yaml linkerd-identity-certs.yaml \
        linkerd-crds-app.yaml linkerd-control-plane-app.yaml
git commit -m "GitOps: install Linkerd 2.20 via Buoyant stable charts"
git push

argocd app sync cert-manager
argocd app sync linkerd-crds
argocd app sync linkerd-control-plane
```

## Step 8 — Verify

```bash
linkerd check
linkerd version
kubectl get pods -n linkerd
```

## Step 9 — Mesh your services

Annotate your Deployments with `linkerd.io/inject: enabled` under
`spec.template.metadata.annotations` and let Argo CD roll them — same
manual step discussed earlier, just now the control plane itself is
Git-managed too.

---

## Flux equivalent

Same shape, different CRDs:

- `cert-manager`, `linkerd-crds`, `linkerd-control-plane` each become a
  `HelmRepository` + `HelmRelease` pair instead of an Argo CD `Application`.
- Replace `argocd.argoproj.io/sync-wave` ordering with `spec.dependsOn` on
  each `HelmRelease` (e.g. `linkerd-control-plane` depends on
  `linkerd-crds`, which depends on `cert-manager`).
- Certificates (Step 4) are unchanged — cert-manager CRDs work identically
  regardless of which GitOps tool manages them.
