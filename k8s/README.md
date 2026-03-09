# Minikube Deployment Guide — Search Service

This directory contains all Kubernetes manifests to run the full **Search Service** stack on a local [Minikube](https://minikube.sigs.k8s.io/) cluster.

The application image is automatically built and pushed to **Docker Hub** by the GitHub Actions CI/CD pipeline on every push to `master`. Kubernetes just pulls it from there.

---

## Architecture on Kubernetes

```
                    ┌─────────────────────────────────────────┐
                    │            Ingress (nginx)              │
                    │                                         │
  search-service.local ──► search-service-app-service :3000  │
  kibana.local         ──► kibana-service            :5601   │
  pgadmin.local        ──► pgadmin-service           :80     │
  kafka-ui.local       ──► kafka-ui-service          :8080   │
                    └──────────────────┬──────────────────────┘
                                       │
              ┌────────────────────────┤
              │                        │
┌─────────────▼──────────┐  ┌─────────▼──────────────┐
│  search-service-app x2 │  │  kibana                │
│  Deployment :3000       │  │  pgadmin               │
│  (Docker Hub image)     │  │  kafka-ui              │
└──────┬──────────┬───────┘  └────────────────────────┘
       │          │
┌──────▼───┐  ┌──▼──────────────────┐
│ postgres │  │ elasticsearch       │
│ StatefulSet│ │  Deployment :9200   │
│ :5432    │  └─────────────────────┘
└────┬─────┘
     │ WAL (logical replication)
┌────▼──────────────────┐
│  kafka-connect        │  ← Debezium
│  Deployment :8083     │
└────┬──────────────────┘
     │
┌────▼──────────┐
│  kafka :9092  │
└────┬──────────┘
     │
┌────▼────────────────┐
│  zookeeper :2181    │
└─────────────────────┘
```

---

## Manifests Overview

| File | What it creates |
|------|----------------|
| `namespace.yaml` | `search-service` namespace |
| `configmap.yaml` | Non-secret environment variables (service DNS names, ports, topics) |
| `secret.yaml` | Credentials (Postgres user/password, DATABASE_URL) |
| `postgres.yaml` | PostgreSQL StatefulSet + PVC + init-SQL ConfigMap + headless Service |
| `elasticsearch.yaml` | Elasticsearch Deployment + PVC + Service |
| `zookeeper.yaml` | Zookeeper Deployment + Service |
| `kafka.yaml` | Kafka Deployment + Service |
| `kafka-connect.yaml` | Debezium Kafka Connect Deployment + Service |
| `app.yaml` | Search Service App Deployment (Docker Hub image) + Service |
| `kibana.yaml` | Kibana Deployment + Service |
| `pgadmin.yaml` | pgAdmin Deployment + PVC + Service |
| `kafka-ui.yaml` | Kafka UI Deployment + Service (includes Debezium Connect link) |
| `ingress.yaml` | Nginx Ingress — four virtual hosts (app, kibana, pgAdmin, kafka-ui) |
| `debezium-connector-job.yaml` | One-shot Job that registers the Debezium connector |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Minikube](https://minikube.sigs.k8s.io/docs/start/) | ≥ 1.32 | `winget install Kubernetes.minikube` |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | ≥ 1.28 | `winget install Kubernetes.kubectl` |
| Docker Desktop | Any recent | Running in background |
| CI/CD pushed image | — | Push to `master` to trigger |

> **Minimum resources for Minikube**: 4 CPUs, 6 GB RAM (Elasticsearch is the hungry one).

---

## Step-by-Step Deployment

### 1. Start Minikube

```powershell
minikube start --cpus=4 --memory=6144 --driver=docker
```

Enable the Ingress add-on (required for `search-service.local`):

```powershell
minikube addons enable ingress
```

### 2. Set Your Docker Hub Username

Open `k8s/app.yaml` and replace `<DOCKER_HUB_USERNAME>` with your actual Docker Hub username (the one used in the CI/CD secrets):

```yaml
image: yourname/search-service:latest   # ← change this
```

### 3. Apply All Manifests

Run from the **project root** (`d:\nodejs\search_service`):

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/elasticsearch.yaml
kubectl apply -f k8s/zookeeper.yaml
kubectl apply -f k8s/kafka.yaml
kubectl apply -f k8s/kafka-connect.yaml
kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/ingress.yaml
```

Or apply everything at once (order is handled by readiness probes):

```powershell
kubectl apply -f k8s/
```

### 4. Wait for All Pods to be Ready

```powershell
kubectl get pods -n search-service -w
```

Expected output (all pods `Running`, `1/1` or `2/2`):

```
NAME                                  READY   STATUS    RESTARTS   AGE
elasticsearch-xxxxxxxxxx-xxxxx        1/1     Running   0          3m
kafka-xxxxxxxxxx-xxxxx                1/1     Running   0          2m
kafka-connect-xxxxxxxxxx-xxxxx        1/1     Running   0          2m
postgres-0                            1/1     Running   0          3m
search-service-app-xxxxxxxxxx-xxxxx   1/1     Running   0          90s
search-service-app-xxxxxxxxxx-yyyyy   1/1     Running   0          90s
zookeeper-xxxxxxxxxx-xxxxx            1/1     Running   0          3m
```

> ⏱️ First startup takes ~3–5 minutes due to image pulls and Elasticsearch warmup.

### 5. Register the Debezium Connector

Once all pods are `Running`, apply the connector registration job:

```powershell
kubectl apply -f k8s/debezium-connector-job.yaml
```

Check the job logs to confirm registration:

```powershell
kubectl logs -n search-service job/register-debezium-connector
```

Expected output:
```
Waiting for Kafka Connect to be ready...
Kafka Connect is ready. Registering connector...
HTTP 201
Connector registration complete.
```

> If you see `HTTP 409`, the connector already exists — that's fine.

### 6. Add Hosts File Entry

Get the Minikube IP:

```powershell
minikube ip
# e.g. 192.168.49.2
```

Add **all four lines** to `C:\Windows\System32\drivers\etc\hosts` (open Notepad as Administrator):

```
192.168.49.2   search-service.local
192.168.49.2   kibana.local
192.168.49.2   pgadmin.local
192.168.49.2   kafka-ui.local
```

> Replace `192.168.49.2` with your actual `minikube ip` output.

### 7. Start Minikube Tunnel (Windows Required)

In a **separate PowerShell terminal (as Administrator)**, run:

```powershell
minikube tunnel
```

Keep this terminal open. This routes traffic from `search-service.local` through the Ingress.

---

## Verify the Deployment

### Search Service API

```powershell
# Health check
curl http://search-service.local/health
# { "status": "ok" }

# Create a product
curl -X POST http://search-service.local/api/products `
  -H "Content-Type: application/json" `
  -d '{"title":"iPhone 15 Pro","brand":"Apple","category":"Smartphones","price":999.99,"stock":50}'

# Search
curl "http://search-service.local/api/search?q=iphone"
```

### Observability UIs

| URL | Tool | Purpose | Credentials |
|-----|------|---------|-------------|
| http://kibana.local | Kibana | Elasticsearch index browser & Dev Tools | — |
| http://pgadmin.local | pgAdmin | PostgreSQL GUI | `admin@admin.com` / `admin123` |
| http://kafka-ui.local | Kafka UI | Topics, consumer groups, Debezium connectors | — |

#### pgAdmin — Connect to PostgreSQL

After logging into pgAdmin, register the server:
- **Host**: `postgres-service`
- **Port**: `5432`
- **Database**: `search_db`
- **Username**: `postgres`
- **Password**: `password`

#### Kibana — Check the products index

Go to **Dev Tools → Console** and run:
```
GET /products/_count
GET /products/_search?q=iphone
```

#### Kafka UI — Verify CDC topics

Navigate to **Topics** and look for:
- `dbserver1.public.Product` — CDC events from Debezium
- `debezium_connect_offsets`, `debezium_connect_configs`, `debezium_connect_statuses`

Navigate to **Kafka Connect** to see the registered connector status.

---

## Useful kubectl Commands

```powershell
# Watch all pods
kubectl get pods -n search-service -w

# View app logs (follow)
kubectl logs -n search-service -l app=search-service-app -f

# View Debezium connector logs
kubectl logs -n search-service -l app=kafka-connect -f

# Describe a failing pod
kubectl describe pod <pod-name> -n search-service

# Check Debezium connector status via port-forward
kubectl port-forward -n search-service svc/kafka-connect-service 8083:8083
# then in another terminal:
curl http://localhost:8083/connectors/products-connector-v4/status

# Port-forward Elasticsearch (for debugging)
kubectl port-forward -n search-service svc/elasticsearch-service 9200:9200

# Port-forward Postgres (for debugging)
kubectl port-forward -n search-service svc/postgres-service 5432:5432
```

---

## Updating the App (CI/CD Flow)

```
git push origin master
       │
       ▼
GitHub Actions (.github/workflows/docker.yml)
  → docker build -t <username>/search-service:latest .
  → docker push   <username>/search-service:latest
       │
       ▼
kubectl rollout restart deployment/search-service-app -n search-service
```

After a new image is pushed, force Kubernetes to pull it:

```powershell
kubectl rollout restart deployment/search-service-app -n search-service
kubectl rollout status  deployment/search-service-app -n search-service
```

---

## Tear Down

```powershell
# Remove all search-service resources
kubectl delete namespace search-service

# Stop Minikube
minikube stop

# Delete Minikube cluster (removes all data)
minikube delete
```

---

## Environment Variables Reference

All environment variables are managed via `configmap.yaml` (non-secret) and `secret.yaml` (credentials). They are injected into the app pod via `envFrom`.

| Variable | Source | Value in Cluster |
|----------|--------|-----------------|
| `POSTGRES_HOST` | ConfigMap | `postgres-service` |
| `POSTGRES_PORT` | ConfigMap | `5432` |
| `POSTGRES_DB` | ConfigMap | `search_db` |
| `POSTGRES_USER` | Secret | `postgres` |
| `POSTGRES_PASSWORD` | Secret | `password` |
| `DATABASE_URL` | Secret | `postgresql://postgres:password@postgres-service:5432/search_db` |
| `ELASTIC_URL` | ConfigMap | `http://elasticsearch-service:9200` |
| `KAFKA_BROKERS` | ConfigMap | `kafka-service:9092` |
| `KAFKA_TOPIC` | ConfigMap | `dbserver1.public.Product` |
| `SEARCH_ENGINE` | ConfigMap | `elastic` |

---

## Troubleshooting

### Pod stuck in `Pending`
```powershell
kubectl describe pod <pod-name> -n search-service
```
Usually means insufficient memory. Increase Minikube memory:
```powershell
minikube stop
minikube start --cpus=4 --memory=8192 --driver=docker
```

### Elasticsearch `CrashLoopBackOff`
The init container `increase-vm-max-map` needs to run with a privileged security context. Make sure your Minikube driver supports it (Docker driver works fine on Windows).

### `ImagePullBackOff` on the app
- Confirm the image was pushed: `docker pull <username>/search-service:latest`
- Confirm you replaced `<DOCKER_HUB_USERNAME>` in `app.yaml`
- If the repo is private, create an image pull secret:
  ```powershell
  kubectl create secret docker-registry regcred \
    --docker-username=<username> \
    --docker-password=<password> \
    -n search-service
  ```
  Then add to `app.yaml` under `spec.template.spec`:
  ```yaml
  imagePullSecrets:
    - name: regcred
  ```

### Debezium connector fails with `slot already exists`
The connector was previously registered. Delete it and re-run the job:
```powershell
kubectl delete job register-debezium-connector -n search-service

# Port-forward Connect and delete the old connector
kubectl port-forward -n search-service svc/kafka-connect-service 8083:8083
curl -X DELETE http://localhost:8083/connectors/products-connector-v4

# Re-apply the job
kubectl apply -f k8s/debezium-connector-job.yaml
```

### `curl: Could not resolve host: search-service.local`
- Confirm the hosts file entry is correct (run Notepad as Administrator)
- Confirm `minikube tunnel` is running in a separate admin terminal
- Try `minikube ip` and verify the IP in the hosts file

---

## Resources

- [Minikube Docs](https://minikube.sigs.k8s.io/docs/)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/2.4/connectors/postgresql.html)
- [Elasticsearch on Kubernetes](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html)
- [Confluent Platform on Kubernetes](https://docs.confluent.io/platform/current/installation/docker/config-reference.html)
