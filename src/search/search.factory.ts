import { ElasticSearchEngine } from './elastic.engine';

// Search always goes to Elasticsearch — it is the dedicated read model.
// All writes go through the product repository → PostgreSQL → outbox → CDC poller → ES.
export const createSearchEngine = (): ElasticSearchEngine => {
  return new ElasticSearchEngine();
};
