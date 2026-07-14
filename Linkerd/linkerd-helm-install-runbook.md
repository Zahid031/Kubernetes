# Installing Linkerd on EKS with Helm

A step-by-step runbook for installing the Linkerd service mesh via Helm, meshing your first gRPC service, and verifying it works. Written for a self-managed EKS cluster running behind an existing API gateway (e.g. APISIX).

## Before you start

**A note on "stable" versions.** As of February 2024, the Linkerd open source project only ships **edge** releases (`helm.linkerd.io/edge`) — there is no longer a separate `helm.linkerd.io/stable` repo maintained by the project itself. The old `linkerd2` chart is deprecated. Two practical paths:

- **Pin an edge release as your own stable baseline** (what this guide does). Edge releases are cut frequently and are the actual upstream artifact; pinning a specific chart version and testing it thoroughly before rollout is the standard approach for teams without a vendor contract.
- **Buoyant Enterprise for Linkerd (BEL)** — a vendor-supported stable distribution with a formal support contract, useful if you want SLA-backed stable releases. Not covered here.

Check the [Linkerd releases page](https://linkerd.io/releases/) for the current edge version before you install, and pin that exact chart version in every command below rather than floating on `latest`.

**Prerequisites:**
- Kubernetes 1.13+ (EKS — any currently supported version works)
- `kubectl` configured against your cluster
- `helm` v3 installed
- `step` CLI (Smallstep) for certificate generation
- Cluster admin access (installing CRDs and a mutating webhook)

**If your cluster runs Cilium in kube-proxy replacement mode**, there are additional steps for service discovery — see the [Cilium cluster configuration notes](https://linkerd.io/2-edge/reference/cluster-configuration/#cilium) before proceeding.

---

## 1. Install the Linkerd CLI

Used for cert validation, `linkerd check`, and day-2 diagnostics — not required at runtime.

```bash
curl -sL https://run.linkerd.io/install | sh
export PATH=$PATH:$HOME/.linkerd2/bin
linkerd version
```

## 2. Pre-flight check

```bash
linkerd check --pre
```

This validates cluster RBAC, kernel/networking requirements, and flags anything that would block sidecar injection (e.g. conflicting iptables rules) before you install anything.

## 3. Install the Gateway API CRDs (if not already present)

Linkerd uses Gateway API CRDs for authorization policy and dynamic request routing.

```bash
# Check if already installed
kubectl get crd gateways.gateway.networking.k8s.io
```

If missing, install the standard channel:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/latest/download/standard-install.yaml
```

## 4. Generate mTLS trust anchor and issuer certificates

Helm installs (unlike `linkerd install`) require you to generate certs yourself. Certs must be ECDSA.

```bash
# Trust anchor (root CA) — long-lived
step certificate create root.linkerd.cluster.local ca.crt ca.key \
  --profile root-ca --no-password --insecure --not-after 87600h

# Issuer cert — shorter-lived, rotated regularly
step certificate create identity.linkerd.cluster.local issuer.crt issuer.key \
  --profile intermediate-ca --not-after 8760h --no-password --insecure \
  --ca ca.crt --ca-key ca.key
```

**Store `ca.key` outside the cluster** (e.g. a secrets manager, not a k8s Secret) — you'll need it to reissue `issuer.crt`/`issuer.key` before the 1-year expiry, and losing it means re-establishing trust cluster-wide.

## 5. Add the Helm repo and pin your version

```bash
helm repo add linkerd-edge https://helm.linkerd.io/edge
helm repo update

# List available versions and pick one to pin
helm search repo linkerd-edge --versions | head -20
```

Set an environment variable so every install/upgrade command below uses the same pinned version:

```bash
export LINKERD_CHART_VERSION="<chart-version-you-selected>"
```

## 6. Install the CRDs chart

```bash
helm install linkerd-crds linkerd-edge/linkerd-crds \
  --version "$LINKERD_CHART_VERSION" \
  -n linkerd --create-namespace
```

## 7. Install the control plane chart

```bash
helm install linkerd-control-plane linkerd-edge/linkerd-control-plane \
  --version "$LINKERD_CHART_VERSION" \
  -n linkerd \
  --set-file identityTrustAnchorsPEM=ca.crt \
  --set-file identity.issuer.tls.crtPEM=issuer.crt \
  --set-file identity.issuer.tls.keyPEM=issuer.key \
  --set proxy.resources.cpu.request=100m \
  --set proxy.resources.memory.request=64Mi \
  --set controllerReplicas=3
```

Notes on the flags:
- `controllerReplicas=3` spreads the control plane across AZs — matches a typical 3-AZ EKS layout.
- Explicit `proxy.resources` requests keep sidecar sizing predictable for cluster autoscalers (Karpenter, Cluster Autoscaler) rather than relying on chart defaults.
- If you use Linkerd's CNI plugin instead of the default proxy-init iptables approach, add `--set cniEnabled=true` to this command (and install the `linkerd2-cni` chart first).

## 8. Verify the control plane

```bash
linkerd check
```

Every check should pass before proceeding. Common early failures are cert mismatches (wrong file passed to the wrong flag) or webhook admission issues — `linkerd check` reports these with fix-it links.

## 9. (Optional) High-availability values

The control plane chart ships a `values-ha.yaml` with higher replica counts, resource limits, and pod anti-affinity:

```bash
helm fetch --untar linkerd-edge/linkerd-control-plane --version "$LINKERD_CHART_VERSION"

helm install linkerd-control-plane linkerd-edge/linkerd-control-plane \
  --version "$LINKERD_CHART_VERSION" \
  -n linkerd \
  --set-file identityTrustAnchorsPEM=ca.crt \
  --set-file identity.issuer.tls.crtPEM=issuer.crt \
  --set-file identity.issuer.tls.keyPEM=issuer.key \
  -f linkerd-control-plane/values-ha.yaml
```

## 10. Install the viz extension (dashboard + metrics)

Optional if you're relying entirely on your existing Tempo/Prometheus stack, but useful for quick `linkerd viz` CLI checks during rollout.

```bash
helm install linkerd-viz linkerd-edge/linkerd-viz \
  --version "$LINKERD_CHART_VERSION" \
  -n linkerd-viz --create-namespace

linkerd viz dashboard
```

## 11. Mesh your first service

**Don't inject cluster-wide on day one.** Pick one or two low-risk services — ideally ones already using gRPC, since that's the concrete problem this solves — and inject just those.

Add the annotation at the namespace or deployment level:

```yaml
metadata:
  annotations:
    linkerd.io/inject: enabled
```

Then roll the deployment so the webhook injects the sidecar:

```bash
kubectl rollout restart deploy/<your-grpc-service> -n <namespace>
```

## 12. Confirm meshing and mTLS

```bash
linkerd viz stat deploy -n <namespace>
linkerd viz edges deploy -n <namespace>
```

`stat` shows live success rate and latency per meshed workload. `edges` confirms which connections are meshed and encrypted — look for `TLS: true` on the relevant edges.

## 13. Expand gradually

Once the pilot services look healthy (even gRPC load distribution across pods, no unexpected latency regression, clean `linkerd viz edges` output), extend the `linkerd.io/inject: enabled` annotation namespace-by-namespace rather than all at once. Watch Grafana/Tempo after each batch.

---

## Upgrading

```bash
helm repo update

# Check available versions and breaking changes before bumping
helm search repo linkerd-edge --versions | head -5
```

Keep a `values.yaml` with all your custom overrides checked into version control rather than relying on `--set` flags at upgrade time. Then:

```bash
helm upgrade linkerd-crds linkerd-edge/linkerd-crds \
  --version "$NEW_LINKERD_CHART_VERSION"

helm upgrade linkerd-control-plane linkerd-edge/linkerd-control-plane \
  --version "$NEW_LINKERD_CHART_VERSION" \
  --reset-values -f values.yaml --atomic
```

`--atomic` rolls back automatically if the upgrade fails partway through. Always diff the new chart's `values.yaml` against your pinned override file first — check the [chart's Artifact Hub page](https://artifacthub.io/packages/helm/linkerd2-edge/linkerd-control-plane) for renamed or moved keys between versions.

## Certificate rotation

The issuer cert generated in step 4 expires in 1 year (per `--not-after 8760h`). Before expiry, reissue it from the same root CA and roll it via `helm upgrade` with the new `--set-file` values — do this well before expiry, since an expired issuer cert breaks mTLS cluster-wide.

## Managing this via Terraform

If your infrastructure is Terraform-managed with layered state, wrap these Helm releases in a `helm_release` resource in a dedicated layer (e.g. alongside an existing `addons` layer), pinning `chart_version` explicitly and sourcing the cert PEMs from a secrets backend rather than local files. This keeps version pins and cert rotation auditable instead of being ad hoc `helm install` runs.

## Troubleshooting quick reference

| Symptom | Likely cause |
|---|---|
| `linkerd check` fails on identity | Cert/key mismatch between `--set-file` flags — double check crt/key pairing |
| Sidecar not injected despite annotation | Webhook namespace selector excludes the namespace (check `proxyInjector.namespaceSelector`), or annotation is at wrong level |
| `linkerd-viz` install fails with missing CRD kind | CRDs chart version doesn't match control plane version — reinstall `linkerd-crds` at the matching pinned version |
| Uneven gRPC load after meshing | Confirm the client is actually going through the meshed pod-to-pod path, not bypassing via a headless Service misconfiguration |
