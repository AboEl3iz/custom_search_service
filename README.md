#  Smart E-Commerce Search Service

A high-performance TypeScript-based search service for e-commerce platforms with semantic search, auto-correction, and autocomplete capabilities powered by PostgreSQL and Elasticsearch.

##  Features

### Core Capabilities
- **Full-Text Search**: Semantic search that understands intent, not just exact matches
- **Auto-Correct**: Automatically fixes user typos (e.g., "iphune" → "iPhone")
- **Autocomplete/Suggestions**: Real-time suggestions while typing (e.g., "iph" → "iPhone 15", "iPhone 15 Pro")
- **Multi-Engine Support**: Switch between PostgreSQL and Elasticsearch based on your needs

### Advanced Features
- Fuzzy matching for typo tolerance
- Weighted relevance scoring
- Brand and category filtering support
- Health check endpoints

---

##  Project Architecture

```
search-service/
├── src/
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # Server entry point
│   │
│   ├── routes/
│   │   └── search.routes.ts      # API route definitions
│   │
│   ├── controllers/
│   │   └── search.controller.ts  # Request handlers
│   │
│   ├── search/
│   │   ├── search.engine.ts      # Interface/contract
│   │   ├── postgres.engine.ts    # PostgreSQL implementation
│   │   ├── elastic.engine.ts     # Elasticsearch implementation
│   │   └── search.factory.ts     # Engine factory pattern
│   │
│   ├── db/
│   │   └── postgres.ts           # PostgreSQL connection pool
│   │
│   ├── seed/
│   │   ├── seed.postgres.ts      # PostgreSQL data seeding
│   │   └── seed.elastic.ts       # Elasticsearch index seeding
│   │
│   └── utils/
│       └── normalize.ts          # Query normalization utilities
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
│
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile
└── .env
```

---

##  Database Implementations

### PostgreSQL Engine

**Use Case**: Lightweight, fallback option for smaller to medium datasets

**Features**:
- Full-text search using `tsvector` and `plainto_tsquery`
- Fuzzy matching with `pg_trgm` extension (`similarity()` function)
- Autocomplete using `ILIKE` with `DISTINCT`
- Native SQL driver (`pg`) for direct queries

**Requirements**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Key Operations**:
- **Full-text search**: Ranked results using `ts_rank()` and text vector search
- **Auto-correct**: Fuzzy matching via `similarity()` function, returns best match
- **Autocomplete**: Pattern matching with `ILIKE`, returns top 10 suggestions

### Elasticsearch Engine

**Use Case**: Large-scale, high-performance search with advanced analytics

**Features**:
- Custom edge_ngram tokenizer for autocomplete
- Fuzzy matching with `fuzziness: AUTO`
- Multi-match queries with field-level boosting
- Real-time indexing and search
- Supports complex scoring and aggregations

**Index Features**:
- **Analyzer**: Custom autocomplete analyzer with edge_ngram tokenizer
- **Fields**: Title (analyzed), description, brand & category (keywords)
- **Scoring**: Weighted relevance with match and fuzzy queries

---

##  Sample Product Data

Seven sample products included (iPhones, Samsung phones, MacBooks):
- iPhone 15 Pro, iPhone 15, iPhone 14
- Samsung Galaxy S24 Ultra, Samsung Galaxy S23
- MacBook Pro 16, MacBook Air M2

Each product has: `title`, `description`, `brand`, `category`

---

##  Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or use Docker)
- Elasticsearch 8.0+ (or use Docker)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Seed data
npm run seed_postgres
npm run seed_elastic
```

### Environment Configuration

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

# Choose search engine: "postgres" or "elastic"
SEARCH_ENGINE=postgres
```

### Running Locally

```bash
# Development (with hot-reload)
npm run dev

# Build TypeScript
npm run build

# Production
npm start

# Watch mode
npm run watch
```

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

---

##  API Endpoints

### Search

**GET** `/api/search?q=<query>`

Search for products with auto-correct and suggestions.

**Parameters**:
- `q` (required): Search query
- `engine` (optional): Force "postgres" or "elastic"

**Example**:
```bash
curl "http://localhost:3000/api/search?q=iphone"
```

**Response**:
```json
{
  "query": "iphone",
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

### Health Check

**GET** `/health`

```bash
curl http://localhost:3000/health
# { "status": "ok" }
```

---

##  Development

### Available Scripts

```bash
npm run dev           # Development server with hot-reload
npm run build         # Compile TypeScript to JavaScript
npm run start         # Production server
npm run watch         # Watch TypeScript changes
npm run seed_postgres # Seed PostgreSQL with sample data
npm run seed_elastic  # Seed Elasticsearch with sample data
npm run lint          # Run ESLint
```

---

##  Design Patterns

### Factory Pattern
The `SearchFactory` dynamically selects a search engine based on the `SEARCH_ENGINE` environment variable, allowing runtime engine switching without code changes.

### Interface Pattern
Both `PostgresSearchEngine` and `ElasticSearchEngine` implement the `ISearchEngine` interface, ensuring consistent contracts and interchangeability.

---

##  Current Status

###  Completed
- [x] Express.js server with TypeScript
- [x] PostgreSQL with full-text search and fuzzy matching
- [x] Elasticsearch with autocomplete and fuzzy matching
- [x] Auto-correct functionality with similarity scoring
- [x] Autocomplete/suggestions feature
- [x] Factory pattern for engine selection
- [x] Docker Compose setup
- [x] Database migrations with Prisma
- [x] Sample product seeding for both engines

###  Future Improvements
- [ ] Performance optimization with Redis caching
- [ ] Advanced filtering (brand, category, price range)
- [ ] Faceted search results
- [ ] Search analytics and trending queries
- [ ] Unit and integration tests
- [ ] Frontend integration with React/Vue
- [ ] Query result pagination
- [ ] Search result ranking optimization

---

##  Known Issues & Solutions

### PostgreSQL
- **Fuzzy Matching**: Requires `pg_trgm` extension for `similarity()` function
  - Solution: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  
- **DISTINCT Sorting**: Complex ORDER BY with DISTINCT can cause query issues
  - Solution: Use subqueries or window functions for proper sorting

### Elasticsearch
- **API Compatibility**: Requires Elasticsearch 8.0+
  - Solution: Update Accept headers for proper media type handling
  
- **Ngram Configuration**: Index settings require `max_ngram_diff = 18`
  - Solution: Set in index settings during creation
  
- **Query Accuracy**: Balancing fuzziness with accuracy
  - Solution: Use proper scoring with `match_phrase_prefix` + fuzzy matching + boosting

---

##  Resources & Documentation

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Docker Documentation](https://docs.docker.com/)


