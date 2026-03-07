import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { ensureIndex } from './cdc/elastic.indexer';
import { startKafkaConsumer, stopKafkaConsumer } from './kafka/kafka.consumer';

const PORT = process.env.PORT || 3000;

async function bootstrap(): Promise<void> {
  try {
    // Ensure Elasticsearch index exists with correct mappings
    await ensureIndex();

    // Start the Kafka consumer (Debezium CDC events → Elasticsearch sync)
    await startKafkaConsumer();

    const server = app.listen(PORT, () => {
      console.log(`[App] Server running on http://localhost:${PORT}`);
      console.log(`[App] Architecture: PostgreSQL (writes) + Debezium/Kafka (CDC) + Elasticsearch (reads)`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[App] ${signal} received — shutting down gracefully...`);
      await stopKafkaConsumer();
      server.close(() => {
        console.log('[App] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[App] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
