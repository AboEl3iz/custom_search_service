import { SearchEngine, SearchResult, ProductHit } from './search.engine';
import db from '../db/postgres';

/**
 * PostgreSQL search engine — kept as a fallback/diagnostic tool.
 * In production, search always goes to Elasticsearch.
 * This engine can be used to verify data consistency between PG and ES.
 */
export class PostgresSearchEngine extends SearchEngine {
    async search(q: string): Promise<SearchResult> {
        const normalized = q.trim().toLowerCase();
        const corrected = await this.autoCorrect(normalized);

        const [suggestions, results] = await Promise.all([
            this.autoComplete(corrected),
            this.fullTextSearch(corrected),
        ]);

        return { query: q, corrected, suggestions, results };
    }

    async autoComplete(q: string): Promise<string[]> {
        const result = await db.query(
            `SELECT DISTINCT title
       FROM "Product"
       WHERE title ILIKE $1
       ORDER BY title
       LIMIT 10`,
            [q + '%']
        );
        return result.rows.map((r: any) => r.title as string);
    }

    async autoCorrect(q: string): Promise<string> {
        const result = await db.query(
            `SELECT title
       FROM "Product"
       ORDER BY similarity(lower(title), lower($1)) DESC
       LIMIT 1`,
            [q]
        );
        return result.rows[0]?.title ?? q;
    }

    async fullTextSearch(q: string): Promise<ProductHit[]> {
        const result = await db.query(
            `SELECT id, title, description, brand, category, price, stock,
         ts_rank(
           setweight(to_tsvector('english', title), 'A') ||
           setweight(to_tsvector('english', coalesce(description,'')), 'B'),
           plainto_tsquery('english', $1)
         ) AS score
       FROM "Product"
       WHERE (
         setweight(to_tsvector('english', title), 'A') ||
         setweight(to_tsvector('english', coalesce(description,'')), 'B')
       ) @@ plainto_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT 20`,
            [q]
        );
        return result.rows as ProductHit[];
    }
}
