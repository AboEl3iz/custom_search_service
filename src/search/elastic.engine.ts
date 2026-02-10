import { SearchEngine } from "./search.engine";
import { Client } from "@elastic/elasticsearch";
import dotenv from 'dotenv';
dotenv.config();
export class ElasticSearchEngine extends SearchEngine {
  private client: Client;

  constructor() {
    super();
    const host = process.env.ELASTICSEARCH_HOST || "localhost";
    const port = process.env.ELASTICSEARCH_PORT || "9200";
    const node = process.env.ELASTIC_URL || `http://${host}:${port}`;

    this.client = new Client({
      node,
      headers: { Accept: "application/vnd.elasticsearch+json; compatible-with=8" }
    });
  }

  async search(q: string): Promise<any> {
    const fuzziness = q.length >= 4 ? "AUTO" : "0";

    const res = await this.client.search({
      index: "products",
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ["title^3", "description"],
            fuzziness: fuzziness,
            operator: "or"
          }
        }
      }
    });

    const hits = (res.hits.hits as any[])
      .map(h => ({
        id: h._id,
        title: h._source.title,
        description: h._source.description,
        score: h._score
      }))
      .filter(h => h.title.toLowerCase().includes(q.toLowerCase()) || h.score > 0);

    const corrected = hits[0]?.title || q;
    const suggestions = hits.slice(0, 5).map(h => h.title);

    return { query: q, corrected, suggestions, results: hits };
  }
}
