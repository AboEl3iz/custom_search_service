import { SearchEngine, SearchResult, ProductHit } from './search.engine';
import esClient from '../db/elastic';
import dotenv from 'dotenv';
dotenv.config();

const INDEX = process.env.ELASTIC_INDEX || 'products';

export class ElasticSearchEngine extends SearchEngine {

  async search(q: string): Promise<SearchResult> {
    const fuzziness = q.length >= 4 ? 'AUTO' : '0';

    const res = await esClient.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ['title^3', 'description', 'brand^2', 'category'],
            fuzziness,
            operator: 'or',
          },
        },
        suggest: {
          title_suggest: {
            prefix: q,
            completion: {
              field: 'title_suggest',
              size: 5,
              fuzzy: { fuzziness: 'AUTO' },
            },
          },
        },
        size: 20,
      },
    });

    const hits: ProductHit[] = (res.hits.hits as any[]).map((h) => ({
      ...(h._source as ProductHit),
      id: h._id,
      score: h._score,
    }));

    const corrected =
      hits.length > 0 ? (hits[0].title ?? q) : q;

    // Suggestions from ES suggest API first, fallback to top hit titles
    let suggestions: string[] = [];
    const suggestBuckets = (res as any).suggest?.title_suggest ?? [];
    if (suggestBuckets.length > 0) {
      suggestions = (suggestBuckets[0].options ?? []).map(
        (o: any) => o._source?.title ?? o.text
      );
    }
    if (suggestions.length === 0) {
      suggestions = hits.slice(0, 5).map((h) => h.title);
    }

    return { query: q, corrected, suggestions, results: hits };
  }
  // samsung  sam

  async autoComplete(q: string): Promise<string[]> {
    const res = await esClient.search({
      index: INDEX,
      body: {
        query: {
          match_phrase_prefix: {
            title: { query: q, max_expansions: 10 },
          },
        },
        _source: ['title'],
        size: 10,
      },
    });
    return (res.hits.hits as any[]).map((h) => h._source.title as string);
  }

  async autoCorrect(q: string): Promise<string> {
    const res = await esClient.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ['title^3', 'description'],
            fuzziness: 'AUTO',
          },
        },
        _source: ['title'],
        size: 1,
      },
    });
    const top = (res.hits.hits as any[])[0];
    return top?._source?.title ?? q;
  }
}
