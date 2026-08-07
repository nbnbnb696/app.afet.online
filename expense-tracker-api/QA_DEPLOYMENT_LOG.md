# Expense Tracker API – QA Deployment Log
**Date**: 30–31 July 2026
**Environment**: AKS (`et-dev` cluster) — `qa` namespace
**Goal**: Access Swagger UI securely at `https://api-qa.afet.online`

---

## Infrastructure Overview

| Component | Value |
|---|---|
| AKS Cluster | `et-dev` |
| Resource Group | `expense-tracker-app` |
| AKS Node Resource Group | `mc_expense-tracker-app_et-dev_southindia` |
| Kubernetes Namespace | `qa` |
| NGINX Ingress Controller IP | `20.219.96.241` |
| Domain / Host | `api-qa.afet.online` |
| ClusterIssuer | `letsencrypt-prod` (shared, cluster-scoped, already existed) |

---

## Activity 1 – Add Ingress for QA (Helm)

### Context
The API was already deployed to `qa` and reachable over plain `http://` via the app's own `Service` (`type: LoadBalancer`). There was no `Ingress` for `qa` at all — only a static `ingress.yaml` hardcoded to `namespace: dev`, and the API Helm chart (`helm/expense-tracker-api`) had no ingress template.

### Changes Made

**New file — `helm/expense-tracker-api/templates/ingress.yaml`:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: expensetracker-ingress
  namespace: {{ .Values.namespace }}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - {{ .Values.ingress.host }}
    secretName: {{ .Values.ingress.tlsSecretName }}
  rules:
  - host: {{ .Values.ingress.host }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: expensetracker-service
            port:
              number: {{ .Values.service.port }}
```

**`values.yaml` (dev default) — added:**
```yaml
ingress:
  host: api.afet.online
  tlsSecretName: api-afet-tls
```

**`values-qa.yaml` — added:**
```yaml
ingress:
  host: api-qa.afet.online
  tlsSecretName: api-qa-afet-tls
```

### Deploy Command
```bash
helm upgrade --install expense-tracker-api helm/expense-tracker-api -n qa -f helm/expense-tracker-api/values-qa.yaml
```

### Note
No new `ClusterIssuer` was needed — `letsencrypt-prod` is cluster-scoped and already shared across all namespaces.

---

## Activity 2 – Fix Azure LB Health Probe Blocking All Traffic (HTTPS Never Issued)

### Issue
After deploying the `Ingress`, the cert-manager `Certificate` for `api-qa-afet-tls` stayed `READY: False` indefinitely. Swagger was still only reachable over `http://` via the app's own LoadBalancer IP, never via `https://api-qa.afet.online`.

### Error
```
$ kubectl describe certificate api-qa-afet-tls -n qa
Status:
  Conditions:
    Message: The certificate request has failed to complete and will be retried:
             Failed to wait for order resource "api-qa-afet-tls-1-2299060280" to become ready: order is in "invalid" state
    Reason:  Failed

$ kubectl get order -n qa
NAME                           STATE     AGE
api-qa-afet-tls-1-2299060280   invalid   3h1m

$ kubectl get challenges -n qa
NAME                                      STATE     DOMAIN               AGE
api-qa-afet-tls-1-2299060280-3876268630   invalid   api-qa.afet.online   3h2m

$ kubectl describe challenge -n qa
Status:
  Reason: Error accepting authorization: acme: authorization error for api-qa.afet.online:
          400 urn:ietf:params:acme:error:connection: 20.219.96.241:
          Fetching http://api-qa.afet.online/.well-known/acme-challenge/iuujfN0_hLZJZKhkzcW4vrdrj_AD6exm7XiGAlOnT_o:
          Timeout during connect (likely firewall problem)
  State: invalid
```

### Diagnosis Steps

**Step 1 – Get the ingress controller's actual external IP:**
```bash
kubectl get svc -n ingress-nginx
```
```
NAME                        TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)
ingress-nginx-controller    LoadBalancer   10.240.15.180   20.219.96.241   80:31544/TCP,443:30732/TCP
```

**Step 2 – Check DNS resolution:**
```bash
nslookup api-qa.afet.online
```
Found `api-qa.afet.online` was resolving to `52.140.59.175` — **not** `20.219.96.241`. This was a real, separate DNS misconfiguration (the record pointed at a different Service's LoadBalancer IP entirely). Fixed the DNS `A` record at the registrar, then re-verified against a public resolver to bypass local caching:
```bash
nslookup api-qa.afet.online 8.8.8.8
# Address: 20.219.96.241   ✅ now correct
```
Fixing DNS alone did **not** resolve the timeout — the challenge still failed the same way, pointing to a second, independent problem downstream of DNS.

**Step 3 – Check NSG rules (ruled out as the cause):**
```bash
az network nsg rule list --nsg-name aks-agentpool-16534096-nsg --resource-group mc_expense-tracker-app_et-dev_southindia -o table
```
All relevant rules were `Allow` for TCP 80/443 inbound from `Internet` to `20.219.96.241`. No `Deny` rules present. NSG was not the blocker.

**Step 4 – Confirm the ingress-nginx pod/Service itself was healthy:**
```bash
kubectl get pods -n ingress-nginx
kubectl get endpoints ingress-nginx-controller -n ingress-nginx
```
```
NAME                       ENDPOINTS                        AGE
ingress-nginx-controller   10.244.0.58:443,10.244.0.58:80   14d
```
Endpoint healthy — the ingress-nginx pod itself was fine.

**Step 5 – Test raw external connectivity independently of Let's Encrypt:**
```bash
curl -v -m 10 http://20.219.96.241/ -H "Host: api-qa.afet.online"
```
```
*   Trying 20.219.96.241:80...
* Connection timed out after 10006 milliseconds
```
Confirmed this was a real network-level block, not a Let's Encrypt-specific issue — an independent client got the identical timeout.

**Step 6 – Test from inside the cluster (bypasses the external network path entirely):**
```bash
kubectl run tmp-curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -v http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/
# Result: HTTP/1.1 404 Not Found

kubectl run tmp-curl2 --rm -it --image=curlimages/curl --restart=Never -- \
  curl -v http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/healthz
# Result: HTTP/1.1 200 OK
```
nginx-ingress works perfectly internally — `/` gives its default-backend `404`, `/healthz` gives `200`.

**Step 7 – Check the Azure Load Balancer's health probe configuration:**
```bash
az network lb probe list --lb-name kubernetes --resource-group mc_expense-tracker-app_et-dev_southindia -o table
```
```
Name                                       Port    Protocol    RequestPath
------------------------------------------ ------  ----------  -------------
a3241c1f1164c4e61a45abb578e04e23-TCP-80    31544   Http        /
a3241c1f1164c4e61a45abb578e04e23-TCP-443   30732   Https       /
```

### Root Cause
The Azure Standard LoadBalancer's health probe for ports 80/443 used protocol `Http`/`Https` against path `/` on the ingress-nginx nodePorts. nginx returns `404` on `/` when no `Ingress` host matches the bare probe request (the probe sends no matching `Host` header) — a non-`200` response causes Azure to mark the **entire backend as unhealthy**, and once unhealthy, the Standard LB **silently drops all inbound connections** on that port — no RST, just a connection timeout. This explains every symptom observed: the ACME HTTP-01 challenge timeout, the external `curl` timeout, all while NSGs, LB rules, DNS (once fixed), and the ingress-nginx pod itself were completely fine.

### Solution

**Repoint the LB health probe at nginx's `/healthz` path, which always returns `200` regardless of Host header:**
```bash
kubectl annotate svc ingress-nginx-controller -n ingress-nginx \
  service.beta.kubernetes.io/azure-load-balancer-health-probe-request-path=/healthz --overwrite
```
This annotation causes AKS's cloud-controller-manager to recreate the Azure LB probe automatically within 1-2 minutes.

**Verify the probe updated:**
```bash
az network lb probe list --lb-name kubernetes --resource-group mc_expense-tracker-app_et-dev_southindia -o table
```

**Verify external connectivity is restored:**
```bash
curl -v -m 10 http://20.219.96.241/ -H "Host: api-qa.afet.online"
```
```
< HTTP/1.1 308 Permanent Redirect
< Location: https://api-qa.afet.online
```
Connection succeeds now (redirect response, not a timeout) — confirms the backend is marked healthy again.

---

## Activity 3 – Force Certificate Reissuance

### Issue
Even after DNS and the LB probe were both fixed, the existing `Certificate` object (`api-qa-afet-tls`) stayed `READY: False`. cert-manager was still sitting in its retry backoff window from the earlier failed attempt and had not automatically retried:
```bash
kubectl get certificaterequest -n qa
# No resources found in qa namespace.
```

### Solution
Deleted the `Certificate` object directly. It is owned by the `Ingress` (auto-created by cert-manager's ingress-shim via the `cert-manager.io/cluster-issuer` annotation), so it was recreated immediately and issuance restarted from scratch with no backoff delay:
```bash
kubectl delete certificate api-qa-afet-tls -n qa
kubectl get certificate -n qa -w
```

### Result
```
NAME              READY   SECRET            AGE
api-qa-afet-tls   False   api-qa-afet-tls   12s
api-qa-afet-tls   False   api-qa-afet-tls   27s
api-qa-afet-tls   True    api-qa-afet-tls   27s
```
Certificate issued within ~30 seconds once DNS and the LB probe were both correct.

### Final Verification
```bash
curl -v https://api-qa.afet.online/swagger-ui/index.html
```
```
< HTTP/1.1 200
< Strict-Transport-Security: max-age=31536000; includeSubDomains
...
<title>Swagger UI</title>
```
Confirmed valid TLS handshake, `200 OK`, and full Swagger UI HTML returned. Browser access at `https://api-qa.afet.online/swagger-ui/index.html` confirmed working after a local DNS cache flush.

---

## Final State

| Item | Status | URL |
|---|---|---|
| API Ingress (qa) | ✅ Added | `helm/expense-tracker-api/templates/ingress.yaml` |
| TLS Certificate (qa) | ✅ Issued | `api-qa-afet-tls`, auto-renews via Let's Encrypt |
| Swagger UI (qa) | ✅ Live | https://api-qa.afet.online/swagger-ui/index.html |
| DNS `api-qa` record | ✅ Fixed | Now points to `20.219.96.241` (was `52.140.59.175`) |
| LB health probe | ✅ Fixed | Path changed from `/` to `/healthz` |

---

## Key Takeaways

1. **A `Service` of `type: LoadBalancer` does not bypass an `Ingress`** — the ingress controller routes to a Service via its internal ClusterIP/endpoints regardless of whether that Service also has its own external LB IP. The LoadBalancer type just creates a redundant, unsecured second entry point.
2. **`ClusterIssuer` is cluster-scoped** — one `letsencrypt-prod` issuer serves every namespace; only the per-namespace `Ingress`/`Certificate` needs to be created for a new environment.
3. **Azure LB health probes and NSGs are independent layers.** NSG governs network-level reachability; the LB probe governs whether Azure forwards traffic to a backend at all. Both must be correct — a passing NSG check does not mean traffic will actually flow if the probe fails.
4. **An `Http`/`Https` probe against `/` on nginx-ingress will fail** — nginx returns its default-backend `404` for unmatched hosts, causing Azure to mark the backend unhealthy and silently drop *all* traffic on that port, not just for the affected host. Point the probe at `/healthz` instead via `service.beta.kubernetes.io/azure-load-balancer-health-probe-request-path`.
5. **When a stuck `Certificate` needs a retry after fixing the root cause, delete the `Certificate` object itself** (not the lower-level `Order`/`Challenge`/`CertificateRequest`) — since it's owned by the `Ingress`, it's recreated immediately and reissues without waiting on cert-manager's backoff timer.
6. **Always verify DNS against a public resolver** (`nslookup <host> 8.8.8.8`) — local/OS DNS caches can mask a record that was already fixed, or hide a mismatch that's still live.
