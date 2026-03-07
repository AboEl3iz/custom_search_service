import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
dotenv.config();

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

export const kafka = new Kafka({
    clientId: 'search-service',
    brokers,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});
