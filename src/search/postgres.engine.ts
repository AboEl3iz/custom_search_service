import { SearchEngine } from "./search.engine";
import db from "../db/postgres";

export class PostgresSearchEngine extends SearchEngine {
    async search(q: string): Promise<any> {
        // normalize input
        const normalized = q.trim().toLowerCase();

        // autoCorrect
        const corrected = await this.autoCorrect(normalized);

        // suggestions + search parallel
        const [suggestions, results] = await Promise.all([
            this.autoComplete(corrected),
            this.fullTextSearch(corrected)
        ]);

        return {
            query: q,
            corrected,
            suggestions,
            results
        };
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
        return result.rows.map((r: any) => r.title);
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



    async fullTextSearch(q: string): Promise<any> {
        const result = await db.query(
            `SELECT id, title,
        ts_rank(
          search_vector,
          plainto_tsquery('english', $1)
        ) AS score
      FROM (
        SELECT id, title,
          setweight(to_tsvector('english', title), 'A') ||
          setweight(to_tsvector('english', coalesce(description,'')), 'B') AS search_vector
        FROM "Product"
      ) p
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY score DESC
      LIMIT 20`,
            [q]
        );
        return result.rows;
    }
}
