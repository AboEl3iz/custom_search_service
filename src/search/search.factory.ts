import { PostgresSearchEngine } from "./postgres.engine";
import { ElasticSearchEngine } from "./elastic.engine";
import { SearchEngine } from "./search.engine";
import dotenv from 'dotenv';
dotenv.config();
export const createSearchEngine = (): SearchEngine => {
  const engineType = process.env.SEARCH_ENGINE || "postgres";

  if (engineType === "elastic") {
    console.log(`elastic search has been running`)
    return new ElasticSearchEngine();
  }
    console.log(`postgres has been running`)

  return new PostgresSearchEngine();
};
