export interface ISearchEngine {
  search(query: string): Promise<any>;
}

export class SearchEngine implements ISearchEngine {
  async search(query: string): Promise<any> {
    throw new Error("search() not implemented");
  }
}
