import esClient from '../db/elastic';
import dotenv from 'dotenv';
dotenv.config();

const INDEX = process.env.ELASTIC_INDEX || 'products';

/**
 * Ensures the Elasticsearch index exists with the correct mapping.
 * Call once at app startup before starting the CDC poller.
 */
export async function ensureIndex(): Promise<void> {
    const exists = await esClient.indices.exists({ index: INDEX });
    if (exists) {
        console.log(`[ES] Index "${INDEX}" already exists.`);
        return;
    }

    await esClient.indices.create({
        index: INDEX,
        body: {
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                analysis: {
                    analyzer: {
                        product_analyzer: {
                            type: 'custom',
                            tokenizer: 'standard',
                            filter: ['lowercase', 'asciifolding', 'stop'],
                        },
                    },
                },
            },
            mappings: {
                properties: {
                    title: {
                        type: 'text',
                        analyzer: 'product_analyzer',
                        fields: {
                            keyword: { type: 'keyword' },
                        },
                    },
                    title_suggest: {
                        type: 'completion',
                    },
                    description: {
                        type: 'text',
                        analyzer: 'product_analyzer',
                    },
                    brand: { type: 'keyword' },
                    category: { type: 'keyword' },
                    price: { type: 'float' },
                    stock: { type: 'integer' },
                    created_at: { type: 'date' },
                    updated_at: { type: 'date' },
                },
            },
        },
    });

    console.log(`[ES] Index "${INDEX}" created with mappings.`);
}

/**
 * Upsert a single product document into Elasticsearch.
 */
export async function upsertDocument(product: Record<string, any>): Promise<void> {
    const { id, ...doc } = product;
    await esClient.index({
        index: INDEX,
        id: String(id),
        document: {
            ...doc,
            title_suggest: {
                input: [doc.title, ...(doc.brand ? [doc.brand] : [])],
            },
        },
    });
}

/**
 * Delete a product document from Elasticsearch by id.
 */
export async function deleteDocument(id: number | string): Promise<void> {
    try {
        await esClient.delete({ index: INDEX, id: String(id) });
    } catch (err: any) {
        // 404 is acceptable — document may never have been indexed
        if (err?.meta?.statusCode !== 404) throw err;
    }
}
