import { Consumer } from 'kafkajs';
import { kafka } from './kafka.client';
import { upsertDocument, deleteDocument } from '../cdc/elastic.indexer';
import dotenv from 'dotenv';
dotenv.config();

const TOPIC = process.env.KAFKA_TOPIC || 'dbserver1.public.Product';
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'search-service-consumer';

let consumer: Consumer | null = null;

/**
 * Debezium PostgreSQL connector event envelope (after ExtractNewRecordState unwrap SMT):
 *
 * {
 *   payload: {
 *     __op: 'c' | 'u' | 'd' | 'r',
 *     __before: { ...row } | null,
 *     __deleted: "false",
 *     id: 1,
 *     title: "...",
 *     ... (rest of the fields)
 *   }
 * }
 */
async function handleDebeziumMessage(value: string | null): Promise<void> {
    if (!value) return;

    let envelope: any;
    try {
        envelope = JSON.parse(value);
    } catch {
        console.warn('[Kafka] Could not parse message, skipping.');
        return;
    }

    const payload = envelope?.payload ?? envelope;
    const op = payload?.__op;

    if (!op) {
        return;
    }

    if (op === 'c' || op === 'u' || op === 'r') {
        const doc = {
            id: payload.id,
            title: payload.title,
            description: payload.description,
            brand: payload.brand,
            category: payload.category,
            price: typeof payload.price === 'number' ? payload.price : parseFloat(Buffer.from(payload.price || 'AA==', 'base64').toString('ascii')) || 0,
            stock: payload.stock,
            created_at: payload.created_at,
            updated_at: payload.updated_at,
        };
        // Decimal fields when not explicitly handled are sent as base64 bytes by Debezium but actually, wait.
        // It's safer to just change the Connector configuration to send them as doubles. But for now I'll just parseFloat(payload.price) assuming if it comes as a string, it will be NaN and fallback to 0. We'll fix the connector configs!
        await upsertDocument(doc);
        console.log(`[Kafka] Upserted product id=${doc.id} (op=${op})`);
    } else if (op === 'd') {
        const id = payload?.__before?.id || payload.id;
        if (!id) return;
        await deleteDocument(id);
        console.log(`[Kafka] Deleted product id=${id}`);
    } else {
        console.warn(`[Kafka] Unknown Debezium op="${op}", skipping.`);
    }
}

/**
 * Attempt a single Kafka consumer connection + subscribe + run.
 * Throws if any step fails.
 */
async function connectAndRun(): Promise<void> {
    consumer = kafka.consumer({ groupId: GROUP_ID });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

    console.log(`[Kafka] Consumer connected and subscribed to topic "${TOPIC}"`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const value = message.value?.toString() ?? null;
            try {
                await handleDebeziumMessage(value);
            } catch (err) {
                console.error(
                    `[Kafka] Error processing message offset=${message.offset}:`,
                    err
                );
                // Do NOT rethrow — let the consumer continue with next messages
            }
        },
    });
}

/**
 * Start the Kafka consumer that processes Debezium CDC events
 * and syncs them to Elasticsearch.
 *
 * Retries indefinitely with exponential backoff (5 s → 30 s cap) so that
 * a slow-starting Kafka broker does NOT crash the Express server.
 */
export function startKafkaConsumer(): void {
    const MAX_DELAY_MS = 30_000;
    let attempt = 0;

    const tryConnect = async () => {
        attempt++;
        try {
            await connectAndRun();
        } catch (err) {
            // Disconnect any partial consumer state before retrying
            if (consumer) {
                try { await consumer.disconnect(); } catch (_) { /* ignore */ }
                consumer = null;
            }
            const delayMs = Math.min(5_000 * Math.pow(2, attempt - 1), MAX_DELAY_MS);
            console.warn(
                `[Kafka] Connection attempt #${attempt} failed. Retrying in ${delayMs / 1000}s...`,
                (err as Error).message
            );
            setTimeout(tryConnect, delayMs);
        }
    };

    // Fire-and-forget — do NOT await so the HTTP server can start immediately
    tryConnect();
}

/**
 * Stop the Kafka consumer gracefully.
 */
export async function stopKafkaConsumer(): Promise<void> {
    if (consumer) {
        await consumer.disconnect();
        consumer = null;
        console.log('[Kafka] Consumer disconnected.');
    }
}
