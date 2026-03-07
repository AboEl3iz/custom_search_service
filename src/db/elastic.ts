import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

const node =
    process.env.ELASTIC_URL ||
    `http://${process.env.ELASTICSEARCH_HOST || 'localhost'}:${process.env.ELASTICSEARCH_PORT || '9200'}`;

export const esClient = new Client({
    node,
    headers: {
        Accept: 'application/vnd.elasticsearch+json; compatible-with=8',
    },
});

export default esClient;
