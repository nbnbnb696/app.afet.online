# Expense Tracker – Deployment Log
**Date**: 15 July 2026  
**Environment**: AKS (Azure Kubernetes Service) + Azure SQL + GoDaddy Domain  

---

## Infrastructure Overview

| Component | Value |
|---|---|
| AKS Cluster | `et-dev` |
| Resource Group | `expense-tracker-app` |
| AKS Node Resource Group | `MC_expense-tracker-app_et-dev_southindia` |
| Azure SQL Server | `et-db.database.windows.net` |
| Azure SQL Database | `free-sql-db-3281680` |
| Azure SQL User | `azureuser@et-db` |
| Docker Hub | `somanathmuduli03/expensetracker` |
| Kubernetes Namespace | `dev` |
| Backend External IP | `20.41.234.208` |
| Frontend External IP | `20.235.22.11` |
| NGINX Ingress IP | `20.219.96.241` |
| Domain | `afet.online` (GoDaddy) |

---

## Activity 1 – Fix Registration 500 Error

### Issue
Registration API was returning `500 Internal Server Error`. The `users` and `transactions` tables did not exist in Azure SQL because `azureuser` had no database-level CREATE TABLE permissions. Hibernate could not auto-create tables.

### Error
```
HTTP POST /api/auth/register
500 Internal Server Error

com.microsoft.sqlserver.jdbc.SQLServerException: Invalid object name 'users'.
	Hibernate could not execute JDBC statement:
	insert into users (username, password) values (?, ?)
```

### Solution
Manually created the tables via Azure SQL Query Editor in Azure Portal.

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY IDENTITY,
    username NVARCHAR(255) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL
);

CREATE TABLE transactions (
    id BIGINT PRIMARY KEY IDENTITY,
    amount DECIMAL(10,2),
    category NVARCHAR(255),
    description NVARCHAR(255),
    date DATE,
    type NVARCHAR(50),
    user_id BIGINT FOREIGN KEY REFERENCES users(id)
);
```

### Result
Registration and full CRUD flow working.

---

## Activity 2 – Fix Multi-User Data Isolation Bug

### Issue
All users were seeing the same transactions. `TransactionController` and `TransactionService` were hardcoded to `"defaultUser"` — every user shared the same data.

### Error
```java
// TransactionController.java — hardcoded username
List<Transaction> transactions = transactionService.getTransactions("defaultUser");

// TransactionService.java — always fetching same user
private User getOrCreateDefaultUser() {
    return userRepository.findByUsername("defaultUser")
        .orElseGet(() -> userRepository.save(new User("defaultUser", "")));
}
```

### Solution
- Injected `@AuthenticationPrincipal UserDetails` in `TransactionController`
- Passed `userDetails.getUsername()` to all service methods
- Replaced `getOrCreateDefaultUser()` in `TransactionService` with `userRepository.findByUsername(username).orElseThrow()`
- Removed `getOrCreateDefaultUser()` method entirely

### Files Changed
- `TransactionController.java`
- `TransactionService.java`

### Result
Each user now sees only their own transactions.

---

## Activity 3 – Fix JWT Security Not Being Enforced

### Issue
`SecurityConfig` had `anyRequest().permitAll()` — all endpoints were public. `JwtAuthenticationFilter` was never registered in the filter chain.

### Error
```java
// SecurityConfig.java — all endpoints were open
http.authorizeHttpRequests(auth -> auth
    .anyRequest().permitAll()
);
// JwtAuthenticationFilter was never added to the filter chain
// Any request without a token could access /api/transactions/**
```

### Solution
- Added `JwtAuthenticationFilter` autowire in `SecurityConfig`
- Changed `anyRequest().permitAll()` to permit only `/api/auth/**` and Swagger URLs
- Added `STATELESS` session policy
- Registered JWT filter before `UsernamePasswordAuthenticationFilter`

### Files Changed
- `SecurityConfig.java`

### Result
All `/api/transactions/**` endpoints now require a valid JWT token.

---

## Activity 4 – Domain Purchase and DNS Setup

### Activity
- Purchased domain `afet.online` on GoDaddy
- Set DNS A records for `@`, `app`, and `api` all pointing to NGINX Ingress Controller IP `20.219.96.241`

| Record | Type | Value |
|---|---|---|
| `@` | A | `20.219.96.241` |
| `app` | A | `20.219.96.241` |
| `api` | A | `20.219.96.241` |

---

## Activity 5 – HTTPS Setup with NGINX Ingress + cert-manager

### Activity
Installed NGINX Ingress Controller and cert-manager on AKS.

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true
```

### Created cluster-issuer.yaml
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: somanathmuduli03@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Created ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: expensetracker-ingress
  namespace: dev
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.afet.online
    secretName: app-afet-tls
  - hosts:
    - api.afet.online
    secretName: api-afet-tls
  rules:
  - host: app.afet.online
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: expensetracker-frontend-service
            port:
              number: 80
  - host: api.afet.online
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: expensetracker-service
            port:
              number: 80
```

```bash
kubectl apply -f cluster-issuer.yaml
kubectl apply -f ingress.yaml -n dev
```

---

## Activity 6 – Fix Let's Encrypt HTTP-01 Challenge Failing

### Issue
Certificates `app-afet-tls` and `api-afet-tls` were in `READY: False` state.

### Error
```
$ kubectl get certificate -n dev
NAME           READY   SECRET         AGE
api-afet-tls   False   api-afet-tls   10m
app-afet-tls   False   app-afet-tls   10m

$ kubectl get challenges -n dev
NAME                                   STATE     DOMAIN            AGE
api-afet-tls-1-145278949-2783720378    invalid   api.afet.online   10m
app-afet-tls-1-2359383934-4018155388   invalid   app.afet.online   10m

$ kubectl describe challenge api-afet-tls-1-145278949-2783720378 -n dev
Status:
  Reason: Error accepting authorization: acme: authorization error for api.afet.online:
          400 urn:ietf:params:acme:error:connection: 20.219.96.241:
          Fetching http://api.afet.online/.well-known/acme-challenge/W_JK_j0sE-...
          Timeout during connect (likely firewall problem)
  State:  invalid

$ curl -v http://20.219.96.241/.well-known/acme-challenge/test
*   Trying 20.219.96.241:80...
* connect to 20.219.96.241 port 80 from 0.0.0.0 port 54646 failed: Timed out
curl: (28) Failed to connect to 20.219.96.241 port 80 after 21053 ms: Could not connect to server
```

### Diagnosis Steps

**Step 1 – Check certificate and challenge status:**
```bash
kubectl get certificate -n dev
kubectl get challenges -n dev
kubectl describe challenge api-afet-tls-1-145278949-2783720378 -n dev
```

**Step 2 – Test port 80 reachability:**
```bash
curl -v http://20.219.96.241/.well-known/acme-challenge/test
# Result: Timed out
```

**Step 3 – Verify NGINX Ingress is running:**
```bash
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
# Result: Pod running, External IP 20.219.96.241, ports 80:31544, 443:30732
```

**Step 4 – Check NGINX logs:**
```bash
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=30
# Result: NGINX was serving 200 for challenge tokens internally
```

**Step 5 – Test from inside the cluster:**
```bash
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- curl -v http://10.0.0.4:31544/
# Result: 404 from NGINX — NGINX is working fine internally
```

**Step 6 – Check Azure Load Balancer health probes:**
```bash
az network lb probe list --resource-group MC_expense-tracker-app_et-dev_southindia --lb-name kubernetes -o table
```
Output showed probe `a3241c1f1164c4e61a45abb578e04e23-TCP-80` was using `Http` protocol checking path `/`.

### Root Cause
Azure Load Balancer health probe was set to `Http` protocol checking `/` on nodePort `31544`. NGINX returns `404` for `/` when no ingress host matches. Azure LB interpreted this as the backend being unhealthy and **stopped forwarding all traffic** — including Let's Encrypt's challenge requests. NSG rules were correct all along.

### Solution

**Fix the LB health probe for port 80 — change from Http to Tcp:**
```bash
az network lb probe update \
  --resource-group MC_expense-tracker-app_et-dev_southindia \
  --lb-name kubernetes \
  --name a3241c1f1164c4e61a45abb578e04e23-TCP-80 \
  --protocol Tcp --path ""
```

**Verify port 80 is now reachable:**
```bash
curl -v http://20.219.96.241/.well-known/acme-challenge/test
# Result: 404 from NGINX — port 80 is open and responding
```

**Retrigger certificate issuance:**
```bash
kubectl delete certificate app-afet-tls api-afet-tls -n dev
kubectl apply -f ingress.yaml
kubectl get certificate -n dev -w
```

**Result:**
```
app-afet-tls   True    app-afet-tls   29s
api-afet-tls   True    api-afet-tls   34s
```

Both certificates issued successfully by Let's Encrypt.

---

## Activity 7 – Fix HTTPS Port 443 Not Accessible

### Issue
After certificates were issued, `https://api.afet.online` was still timing out on port 443.

### Error
```
$ curl -v https://api.afet.online/api/auth/login
*   Trying 20.219.96.241:443...
* connect to 20.219.96.241 port 443 from 0.0.0.0 port 50566 failed: Timed out
curl: (28) Failed to connect to api.afet.online port 443 after 21276 ms: Could not connect to server

$ az network lb probe list --resource-group MC_expense-tracker-app_et-dev_southindia --lb-name kubernetes -o table
Name                                      Port    Protocol
----------------------------------------  ------  ----------
a3241c1f1164c4e61a45abb578e04e23-TCP-443  80      Https      ← wrong port, wrong protocol
```

### Diagnosis
```bash
az network lb probe list --resource-group MC_expense-tracker-app_et-dev_southindia --lb-name kubernetes -o table
```
Probe `a3241c1f1164c4e61a45abb578e04e23-TCP-443` was:
- Protocol: `Https`
- Port: `80` (wrong — should be nodePort `30732`)

### Solution

**Fix the 443 probe protocol:**
```bash
az network lb probe update \
  --resource-group MC_expense-tracker-app_et-dev_southindia \
  --lb-name kubernetes \
  --name a3241c1f1164c4e61a45abb578e04e23-TCP-443 \
  --protocol Tcp --path ""
```

**Fix the 443 probe port to nodePort 30732:**
```bash
az network lb probe update \
  --resource-group MC_expense-tracker-app_et-dev_southindia \
  --lb-name kubernetes \
  --name a3241c1f1164c4e61a45abb578e04e23-TCP-443 \
  --port 30732
```

**Verify probe is now correct:**
```bash
az network lb probe list --resource-group MC_expense-tracker-app_et-dev_southindia --lb-name kubernetes -o table
```
```
Name                                      Port    Protocol
----------------------------------------  ------  ----------
a3241c1f1164c4e61a45abb578e04e23-TCP-80   31544   Tcp
a3241c1f1164c4e61a45abb578e04e23-TCP-443  30732   Tcp        ← fixed
```

**Verify HTTPS is working:**
```bash
curl -v https://api.afet.online/api/auth/login
```
```
* Established connection to api.afet.online (20.219.96.241 port 443)
* ALPN: server accepted http/1.1
< HTTP/1.1 403
< Allow: POST
# HTTPS working — 403 expected since /api/auth/login requires POST
```

**Permanent fix — annotate service to always use Tcp probe:**
```bash
kubectl annotate svc ingress-nginx-controller -n ingress-nginx service.beta.kubernetes.io/azure-load-balancer-health-probe-protocol=tcp
```

---

## Activity 8 – Frontend Rebuild and Redeploy with HTTPS

### Files Changed

**`.env.production`**
```
# Before
REACT_APP_API_URL=http://20.41.234.208/api

# After
REACT_APP_API_URL=https://api.afet.online/api
```

**`frontend-deployment.yaml`**
```yaml
# Before
image: somanathmuduli03/expensetracker-frontend:1.0

# After
image: somanathmuduli03/expensetracker-frontend:1.1
```

### Commands
```bash
cd expense-tracker-frontend
docker build -t somanathmuduli03/expensetracker-frontend:1.1 .
docker push somanathmuduli03/expensetracker-frontend:1.1
kubectl apply -f frontend-deployment.yaml
kubectl rollout status deployment/expensetracker-frontend-deployment -n dev
```

### Result
Frontend live at `https://app.afet.online` calling `https://api.afet.online/api`.

---

## Final State

| Item | Status | URL |
|---|---|---|
| Frontend | ✅ Live | https://app.afet.online |
| Backend API | ✅ Live | https://api.afet.online/api |
| Swagger UI | ✅ Live | https://api.afet.online/swagger-ui/index.html |
| TLS Certificates | ✅ Valid | Auto-renews via Let's Encrypt |
| JWT Auth | ✅ Enforced | All `/api/transactions/**` secured |
| Multi-user isolation | ✅ Fixed | Each user sees only their own data |

---

## Preventive Measures

### Permanent Fix – Prevent LB Health Probe from Reverting to Http
AKS sometimes reconciles Load Balancer rules and resets the health probe back to `Http`, which would cause Let's Encrypt renewal to fail again. To prevent this, annotate the NGINX Ingress Controller service to always use `Tcp` probe:

```bash
kubectl annotate svc ingress-nginx-controller -n ingress-nginx service.beta.kubernetes.io/azure-load-balancer-health-probe-protocol=tcp
```

Verify the annotation was applied:
```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx -o yaml | grep -A 10 annotations
```

Force a reconcile to confirm it works:
```bash
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx
```

Verify probe is still `Tcp` after rollout:
```bash
az network lb probe list --resource-group MC_expense-tracker-app_et-dev_southindia --lb-name kubernetes -o table
```

Both `TCP-80` and `TCP-443` probes should show `Tcp` protocol. This ensures cert-manager auto-renewal at day 60 will succeed without manual intervention.

---

## Key Lessons Learned

1. **Azure LB health probe vs NSG are independent layers** — NSG allows traffic at network level, but LB health probe decides whether to forward traffic to backend nodes. Both must be correct.
2. **Http probe on NGINX returns 404 for `/`** — NGINX returns 404 when no ingress host matches, causing Http probes to fail. Always use Tcp probes for NGINX Ingress Controller.
3. **nodePort mapping matters** — LB probe must check the correct nodePort (`31544` for port 80, `30732` for port 443), not the LB frontend port.
4. **TLS termination at NGINX** — Spring Boot app stays on plain HTTP internally. NGINX handles TLS, no changes needed in `application.properties`.
5. **`.env.production` is baked into the Docker image at build time** — any env change requires a full rebuild and new image tag.
