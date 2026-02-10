import { Client } from "@elastic/elasticsearch";

import dotenv from 'dotenv';
dotenv.config();

const host = process.env.ELASTICSEARCH_HOST || "localhost";
const port = process.env.ELASTICSEARCH_PORT || "9200";
const node = process.env.ELASTIC_URL || `http://${host}:${port}`;

const es = new Client({
  node,
});

const products = [
  { title: "iPhone 15 Pro", description: "Apple smartphone with A17 chip", brand: "Apple", category: "phones" },
  { title: "iPhone 15", description: "Apple smartphone with A16 chip", brand: "Apple", category: "phones" },
  { title: "iPhone 14", description: "Apple smartphone previous generation", brand: "Apple", category: "phones" },
  { title: "Samsung Galaxy S24 Ultra", description: "Android flagship phone", brand: "Samsung", category: "phones" },
  { title: "Samsung Galaxy S23", description: "Previous Samsung flagship", brand: "Samsung", category: "phones" },
  { title: "MacBook Pro 16", description: "Apple laptop with M2 Pro", brand: "Apple", category: "laptops" },
  { title: "MacBook Air M2", description: "Apple light laptop", brand: "Apple", category: "laptops" },
];

async function seedElastic() {
  try {
    // delete index if exists
    const exists = await es.indices.exists({ index: "products" });
    if (exists) {
      await es.indices.delete({ index: "products" });
      console.log("🗑 Old index deleted");
    }

    // create index with ngram tokenizer
    await es.indices.create({
      index: "products",
      body: {
        settings: {
          "index.max_ngram_diff": 18, // فرق بين min_gram و max_gram
          analysis: {
            analyzer: {
              autocomplete: {
                type: "custom",
                tokenizer: "ngram_tokenizer",
                filter: ["lowercase"]
              }
            },
            tokenizer: {
              ngram_tokenizer: {
                type: "ngram",
                min_gram: 2,
                max_gram: 20,
                token_chars: ["letter", "digit"]
              }
            }
          }
        },
        mappings: {
          properties: {
            title: { type: "text", analyzer: "autocomplete", search_analyzer: "standard" },
            description: { type: "text" },
            brand: { type: "keyword" },
            category: { type: "keyword" }
          }
        }
      }
    });

    console.log("✅ Elasticsearch index created");

    // bulk insert
    const body = products.flatMap(doc => [{ index: { _index: "products" } }, doc]);
    const bulkResponse = await es.bulk({ refresh: true, body: body as any });

    if ((bulkResponse as any).errors) {
      console.error("❌ Some errors occurred during bulk insert");
    } else {
      console.log("✅ Elasticsearch seeded with products");
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

seedElastic();
