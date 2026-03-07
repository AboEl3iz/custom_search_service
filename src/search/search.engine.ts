export interface ISearchEngine {
  search(query: string): Promise<SearchResult>;
  autoComplete(query: string): Promise<string[]>;
  autoCorrect(query: string): Promise<string>;
}

export interface SearchResult {
  query: string;
  corrected: string;
  suggestions: string[];
  results: ProductHit[];
}

export interface ProductHit {
  id: string | number;
  title: string;
  description?: string;
  brand?: string;
  category?: string;
  price?: number;
  stock?: number;
  score?: number;
}

export abstract class SearchEngine implements ISearchEngine {
  abstract search(query: string): Promise<SearchResult>;
  abstract autoComplete(query: string): Promise<string[]>;
  abstract autoCorrect(query: string): Promise<string>;
}
