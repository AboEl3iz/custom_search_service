#  Smart E-Commerce Search Service

A high-performance TypeScript-based search service for e-commerce platforms with semantic search, auto-correction, and autocomplete capabilities. Built on a **PostgreSQL-primary / Elasticsearch-secondary** architecture with **Debezium + Kafka CDC** for guaranteed, real-time data consistency.

---

##  Features

### Core Capabilities
- **Full-Text Search**: Semantic search powered by Elasticsearch (edge-ngram, fuzzy, multi-match)
- **Auto-Correct**: Automatically fixes user typos (e.g., `"iphune"` → `"iPhone"`)
- **Autocomplete / Suggestions**: Real-time prefix suggestions while typing
- **Product CRUD API**: Full create / read / update / delete over PostgreSQL
- **Debezium CDC Sync**: Writes to PostgreSQL are automatically streamed to Kafka via Debezium (WAL logical replication) and consumed by the app to sync Elasticsearch — no polling required

### Advanced Features
- Debezium PostgreSQL connector (WAL logical replication, zero-polling overhead)
- Kafka consumer with graceful startup / shutdown lifecycle
- `ExtractNewRecordState` SMT for clean Debezium event unwrapping
- GIN index on `tsvector` for fast PostgreSQL full-text fallback
- Trigram index (`pg_trgm`) for fuzzy / autocomplete on PostgreSQL side
- Weighted relevance scoring in Elasticsearch
- Health check endpoints
- Nginx reverse proxy for uniform entry point
- pgAdmin, Kibana & Kafka UI for observability
- **Kubernetes / Minikube** deployment manifests (`k8s/`)
- **CI/CD**: GitHub Actions pipeline that builds and pushes Docker images to Docker Hub on every push to `master`

---

##  Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP :3000
                    ┌──────▼──────┐
                    │    Nginx    │  Reverse proxy
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │  Express App (:3001)    │
              │                         │
              │  /api/products  ──────► PostgreSQL (write)
              │  /api/search    ──────► Elasticsearch (read)
              │  /health                │
              └────────────────────────┘
                      │ WAL logical replication
              ┌───────▼────────┐
              │ Debezium (KC)  │  Kafka Connect :8083
              └───────┬────────┘
                      │ CDC events
              ┌───────▼────────┐
              │    Kafka       │  :9092  (backed by Zookeeper)
              └───────┬────────┘
                      │ topic: dbserver1.public.Product
              ┌───────▼────────────────┐
              │  Kafka Consumer        │  (in-process, src/kafka/)
              │  → upsert / delete     │
              └───────┬────────────────┘
                      │
              ┌───────▼────────┐
              │ Elasticsearch  │  :9200
              └────────────────┘
```

### Data Flow

| Operation | Primary Store | Replication |
|-----------|--------------|-------------|
| INSERT product | PostgreSQL | WAL → Debezium → Kafka → Consumer → Elasticsearch |
| UPDATE product | PostgreSQL | WAL → Debezium → Kafka → Consumer → Elasticsearch |
| DELETE product | PostgreSQL | WAL → Debezium → Kafka → Consumer → Elasticsearch |
| SEARCH | — | Elasticsearch (read) |
| GET product(s) | PostgreSQL | — |

---

##  Project Structure

```
search-service/
├── src/
│   ├── app.ts                        # Express app setup & route mounting
│   ├── index.ts                      # Server entry point + Kafka consumer start
│   │
│   ├── routes/
│   │   └── search.routes.ts          # Search API routes
│   │
│   ├── controllers/
│   │   └── search.controller.ts      # Search request handlers
│   │
│   ├── product/                      # Product CRUD module
│   │   ├── product.routes.ts         # CRUD route definitions
│   │   ├── product.controller.ts     # CRUD request handlers
│   │   ├── product.service.ts        # Business logic layer
│   │   └── product.repository.ts    # PostgreSQL data access (raw pg)
│   │
│   ├── kafka/                        # Kafka / Debezium CDC layer
│   │   ├── kafka.client.ts           # KafkaJS client instance
│   │   └── kafka.consumer.ts         # Debezium event consumer → Elasticsearch sync
│   │
│   ├── cdc/                          # Elasticsearch indexer utilities
│   │   └── elastic.indexer.ts        # Elasticsearch upsert / delete helpers
│   │
│   ├── search/                       # Search engine abstraction
│   │   ├── search.engine.ts          # ISearchEngine interface
│   │   ├── postgres.engine.ts        # PostgreSQL search implementation
│   │   ├── elastic.engine.ts         # Elasticsearch search implementation
│   │   └── search.factory.ts         # Engine selection factory
│   │
│   ├── db/
│   │   ├── postgres.ts               # PostgreSQL connection pool (pg)
│   │   └── elastic.ts                # Elasticsearch client
│   │
│   ├── seed/
│   │   ├── seed.postgres.ts          # PostgreSQL data seeding
│   │   └── seed.elastic.ts           # Elasticsearch index seeding
│   │
│   └── utils/
│       └── normalize.ts              # Query normalization utilities
│
├── k8s/                              # Kubernetes manifests (Minikube)
│   ├── README.md                     # Full Minikube deployment guide
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres.yaml
│   ├── elasticsearch.yaml
│   ├── zookeeper.yaml
│   ├── kafka.yaml
│   ├── kafka-connect.yaml
│   ├── kafka-ui.yaml
│   ├── app.yaml
│   ├── kibana.yaml
│   ├── pgadmin.yaml
│   ├── ingress.yaml
│   └── debezium-connector-job.yaml
│
├── .github/
│   └── workflows/
│       └── docker.yml                # CI/CD: build & push to Docker Hub
│
├── init-db.sql                       # DB init: schema + WAL replication slot support
├── nginx-simple.conf                 # Nginx reverse proxy config
├── docker-compose.yml                # Full local stack (includes Kafka + Debezium)
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env
```

---

##  Database Design

### PostgreSQL (Source of Truth)

**`Product` table** — primary data store for all writes.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-increment |
| title | TEXT NOT NULL | GIN-indexed for FTS + trigram |
| description | TEXT | |
| brand | TEXT | |
| category | TEXT | |
| price | NUMERIC(10,2) | |
| stock | INTEGER | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**:
```sql
-- Full-text search (weighted A/B)
CREATE INDEX idx_product_fts ON "Product" USING GIN (
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
);

-- Trigram index for fuzzy / autocomplete
CREATE INDEX idx_product_trgm ON "Product" USING GIN (title gin_trgm_ops);
```

### PostgreSQL WAL (CDC Source)

Debezium reads from PostgreSQL's **Write-Ahead Log** using logical replication (WAL level `logical`). No application-level triggers or outbox tables are required — Debezium captures every INSERT/UPDATE/DELETE directly from the WAL stream.

```yaml
# PostgreSQL must be started with WAL level = logical
command: postgres -c wal_level=logical
```

---

##  CDC Architecture — Debezium + Kafka

### How It Works

1. **Debezium** (running as Kafka Connect) monitors the PostgreSQL WAL
2. Each DB change is published to the Kafka topic `dbserver1.public.Product`
3. The **in-process Kafka consumer** (`src/kafka/kafka.consumer.ts`) reads these events
4. Events are decoded using the `ExtractNewRecordState` SMT (the `__op` field identifies the operation)
5. The consumer calls `upsertDocument()` or `deleteDocument()` on Elasticsearch accordingly

### Debezium Event Envelope

After the `ExtractNewRecordState` SMT unwraps the event:

```json
{
  "payload": {
    "__op": "c",
    "id": 1,
    "title": "iPhone 15 Pro",
    "brand": "Apple",
    "category": "Smartphones",
    "price": 999.99,
    "stock": 50
  }
}
```

| `__op` value | Meaning | Action |
|---|---|---|
| `c` | INSERT | Upsert to Elasticsearch |
| `u` | UPDATE | Upsert to Elasticsearch |
| `r` | Snapshot read | Upsert to Elasticsearch |
| `d` | DELETE | Delete from Elasticsearch |

### Debezium Connector Config (registered via `debezium-connector-job.yaml`)

Key configuration highlights:
- `plugin.name=pgoutput` — uses PostgreSQL's native logical decoding
- `transforms=unwrap` — `ExtractNewRecordState` for flat payload structure
- `decimal.handling.mode=double` — avoids base64-encoded NUMERIC fields
- `tombstones.on.delete=false` — suppresses Kafka tombstone messages on deletes

---

##  Search Engine Implementations

### Elasticsearch Engine (Default for Search)

**Use Case**: All search queries — autocomplete, full-text, fuzzy matching

**Features**:
- Custom `edge_ngram` tokenizer for prefix autocomplete
- `fuzziness: AUTO` for typo tolerance
- Multi-match queries with field-level boosting (`title^3`, `brand^2`)
- Real-time document indexing via Debezium + Kafka CDC

### PostgreSQL Engine (Fallback)

**Use Case**: Lightweight fallback or datasets where Elasticsearch is unavailable

**Features**:
- Full-text search via `tsvector` / `plainto_tsquery` + `ts_rank()`
- Fuzzy matching via `similarity()` (requires `pg_trgm`)
- Autocomplete via `ILIKE` pattern matching

Switch the active search engine via the `SEARCH_ENGINE` env variable:
```env
SEARCH_ENGINE=elastic   # default; uses Elasticsearch
SEARCH_ENGINE=postgres  # fallback; uses PostgreSQL
```

---

##  Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (recommended)
- Or: PostgreSQL 16+ (with `wal_level=logical`), Elasticsearch 8.11+, Kafka, Debezium

### Quick Start with Docker

```bash
# 1. Clone and configure
cp .env.example .env   # edit as needed

# 2. Start all services (Postgres, Kafka, Zookeeper, Debezium, Elasticsearch, App, Nginx, pgAdmin, Kibana, Kafka UI)
docker-compose up -d

# 3. Register the Debezium connector (first time only)
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @scripts/register-connector.json

# 4. Seed sample data (optional – Debezium auto-captures and syncs to ES)
npm run seed_postgres

# 5. App is available at:
#   http://localhost:3000        (via Nginx)
#   http://localhost:8080        (pgAdmin)
#   http://localhost:5601        (Kibana)
#   http://localhost:8081        (Kafka UI)
#   http://localhost:8083        (Kafka Connect / Debezium)
```

### Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start infrastructure via Docker (Postgres, Elasticsearch, Kafka stack)
docker-compose up -d postgres elasticsearch zookeeper kafka kafka-connect

# Run migrations / init schema
psql -U postgres -d search_db -f init-db.sql

# Seed data
npm run seed_postgres

# Start dev server (hot-reload)
npm run dev
```

---

##  Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=search_db

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTIC_URL=http://localhost:9200

# Search engine to use for /api/search: "elastic" | "postgres"
SEARCH_ENGINE=elastic

# Kafka / Debezium CDC
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=dbserver1.public.Product
KAFKA_GROUP_ID=search-service-consumer
```

---

##  API Reference

### Product CRUD — `/api/products`

All writes go to **PostgreSQL**. Debezium captures the WAL change and the Kafka consumer automatically syncs the changes to **Elasticsearch**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | List products (paginated) |
| `GET` | `/api/products/:id` | Get product by ID |
| `POST` | `/api/products` | Create product |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product |

**Create Product**:
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "title": "iPhone 15 Pro",
    "description": "Latest iPhone with A17 Pro chip",
    "brand": "Apple",
    "category": "Smartphones",
    "price": 999.99,
    "stock": 50
  }'
```

**List Products** (with pagination):
```bash
curl "http://localhost:3000/api/products?page=1&limit=20"
```

---

### Search — `/api/search`

All search queries go to **Elasticsearch** (or PostgreSQL if `SEARCH_ENGINE=postgres`).

**GET** `/api/search?q=<query>`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `q` | ✅ | Search query string |
| `engine` | ❌ | Override engine: `"elastic"` or `"postgres"` |

```bash
curl "http://localhost:3000/api/search?q=iphone"
```

**Response**:
```json
{
  "query": "iphune",
  "corrected": "iphone",
  "suggestions": ["iPhone 15 Pro", "iPhone 15", "iPhone 14"],
  "results": [
    {
      "id": 1,
      "title": "iPhone 15 Pro",
      "score": 0.85
    }
  ]
}
```

---

### Health Check

**GET** `/health`

```bash
curl http://localhost:3000/health
# { "status": "ok" }
```

---

##  Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16 | `5432` | Primary database (WAL `logical`) |
| `elasticsearch` | elasticsearch:8.11.0 | `9200` | Search index |
| `zookeeper` | confluentinc/cp-zookeeper:7.5.0 | `2181` | Kafka metadata broker |
| `kafka` | confluentinc/cp-kafka:7.5.0 | `9092` | Event streaming backbone |
| `kafka-connect` | debezium/connect:2.4 | `8083` | Debezium CDC connector |
| `kafka-ui` | provectuslabs/kafka-ui | `8081` | Kafka topics & connector GUI |
| `app` | (local build) | `3001` | Express API + Kafka consumer |
| `nginx` | nginx:alpine | `3000` | Reverse proxy (public entry) |
| `pgadmin` | dpage/pgadmin4 | `8080` | PostgreSQL GUI |
| `kibana` | kibana:8.11.0 | `5601` | Elasticsearch GUI |

---

##  CI/CD Pipeline

The project includes a **GitHub Actions** workflow (`.github/workflows/docker.yml`) that automatically builds and pushes the Docker image to Docker Hub on every push to `master`.

```
git push origin master
       │
       ▼
GitHub Actions (.github/workflows/docker.yml)
  → docker build -t <username>/search:latest .
  → docker push   <username>/search:latest
                  <username>/search:sha-<short-sha>
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username |
| `DOCKER_HUB_PASSWORD` | Your Docker Hub access token |

The pipeline uses **Docker BuildKit layer caching** via GitHub Actions Cache for fast subsequent builds.

---

##  Kubernetes / Minikube Deployment

The `k8s/` directory contains a complete set of Kubernetes manifests to run the full stack on a local Minikube cluster. See **[k8s/README.md](./k8s/README.md)** for the full step-by-step guide.

### Quick Overview

```powershell
# Start Minikube
minikube start --cpus=4 --memory=6144 --driver=docker
minikube addons enable ingress

# Deploy everything
kubectl apply -f k8s/

# Register Debezium connector
kubectl apply -f k8s/debezium-connector-job.yaml

# Add to C:\Windows\System32\drivers\etc\hosts
# <minikube ip>   search-service.local kibana.local pgadmin.local kafka-ui.local

# Route traffic (run in a separate admin PowerShell)
minikube tunnel
```

### Services Exposed via Ingress

| Host | Service |
|------|---------|
| `http://search-service.local` | Search Service API |
| `http://kibana.local` | Kibana |
| `http://pgadmin.local` | pgAdmin |
| `http://kafka-ui.local` | Kafka UI |

---

##  Available Scripts

```bash
npm run dev           # Development server with hot-reload (ts-node-dev)
npm run build         # Compile TypeScript → dist/
npm run start         # Production server (from dist/)
npm run watch         # Watch TypeScript changes
npm run seed_postgres # Seed PostgreSQL with sample products
npm run seed_elastic  # Seed Elasticsearch index directly
npm run lint          # Run ESLint
```

---

##  Design Patterns

### Debezium / WAL-based CDC
Instead of application-level outbox polling, PostgreSQL's **Write-Ahead Log** is tailed by Debezium. This eliminates polling overhead, reduces DB load, and captures changes even for operations that bypass the application (e.g., direct SQL inserts).

### Factory Pattern
`SearchFactory` dynamically selects the active search engine (`SEARCH_ENGINE` env var), allowing runtime switching without code changes.

### Interface / Strategy Pattern
Both `PostgresSearchEngine` and `ElasticSearchEngine` implement the `ISearchEngine` interface, ensuring consistent contracts and full interchangeability.

### Repository Pattern
`ProductRepository` encapsulates all PostgreSQL data access logic (using the raw `pg` driver for maximum control and performance), while `ProductService` handles business logic independently.

---

##  Current Status

### ✅ Completed
- [x] Express.js server with TypeScript
- [x] PostgreSQL as primary database (source of truth, WAL `logical`)
- [x] Elasticsearch as secondary (search-only) store
- [x] **Debezium + Kafka CDC** replacing the outbox polling pattern
- [x] In-process Kafka consumer (`src/kafka/`) with graceful shutdown
- [x] `ExtractNewRecordState` SMT for clean Debezium event handling
- [x] DELETE propagation fix via `__before.id` fallback in Kafka consumer
- [x] Product CRUD API (`/api/products`) with full pagination
- [x] Full-text search + fuzzy matching via Elasticsearch
- [x] Autocomplete / suggestions (edge-ngram)
- [x] PostgreSQL search engine fallback
- [x] Factory pattern for engine selection
- [x] Nginx reverse proxy
- [x] Docker Compose with full Kafka + Debezium stack
- [x] pgAdmin, Kibana & Kafka UI for observability
- [x] GIN indexes (FTS + trigram) on PostgreSQL
- [x] Sample product seeding
- [x] **GitHub Actions CI/CD** pipeline (Docker Hub push)
- [x] **Kubernetes / Minikube** deployment manifests (`k8s/`)
- [x] Nginx Ingress with TLS-capable virtual hosts

### 🔜 Future Improvements
- [ ] Redis caching layer for hot search results
- [ ] Advanced filtering (price range, brand, category)
- [ ] Faceted search & aggregations
- [ ] Search analytics and trending queries
- [ ] Dead-letter queue for failed Kafka messages
- [ ] Unit and integration tests
- [ ] Frontend integration (React / Vue)
- [ ] Query result pagination for search
- [ ] Rate limiting & request validation middleware
- [ ] Helm chart for production-grade Kubernetes deployment

---

##  Known Issues & Solutions

### PostgreSQL
- **`pg_trgm` not installed**: `similarity()` and trigram indexes require the extension.
  - Solution: The `init-db.sql` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` automatically.

- **WAL level must be `logical`**: Debezium requires PostgreSQL to be started with `wal_level=logical`.
  - Solution: The `docker-compose.yml` passes `command: postgres -c wal_level=logical`, and the PostgreSQL K8s manifest does the same.

### Elasticsearch
- **API Compatibility**: Requires Elasticsearch **8.0+**.
  - Solution: Ensure correct `Accept` headers (`application/vnd.elasticsearch+json`).

- **Ngram diff setting**: Custom edge-ngram tokenizers require `max_ngram_diff ≥ 18`.
  - Solution: Set in index settings during index creation (`seed.elastic.ts`).

- **Security disabled in Docker**: `xpack.security.enabled=false` is set for local dev only. Enable for production.

### Debezium / Kafka
- **`slot already exists`**: Happens when restarting after a connector was already registered.
  - Solution: Delete the old connector via the Connect REST API and re-register.
- **NUMERIC fields as base64**: Debezium may encode `NUMERIC` columns as base64 bytes.
  - Solution: Set `decimal.handling.mode=double` in the connector configuration.
- **Tombstone messages on delete**: Kafka may receive an extra `null`-value tombstone after a delete.
  - Solution: Set `tombstones.on.delete=false` in the connector config.

---

##  Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL `pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/2.4/connectors/postgresql.html)
- [KafkaJS Documentation](https://kafka.js.org/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Minikube Docs](https://minikube.sigs.k8s.io/docs/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
