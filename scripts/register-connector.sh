#!/usr/bin/env bash
# =============================================================================
# register-connector.sh
#
# Registers the Debezium PostgreSQL connector with Kafka Connect.
# Run this ONCE after `docker compose up -d` and all services are healthy.
#
# Usage:
#   bash scripts/register-connector.sh
# =============================================================================

CONNECT_URL="${KAFKA_CONNECT_URL:-http://localhost:8083}"
CONNECTOR_NAME="products-connector-v4"

echo "Waiting for Kafka Connect to be ready at ${CONNECT_URL}..."
until curl -sf "${CONNECT_URL}/" > /dev/null; do
  sleep 3
done
echo "Kafka Connect is ready."

echo "Registering connector '${CONNECTOR_NAME}'..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "${CONNECT_URL}/connectors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"${CONNECTOR_NAME}"'",
    "config": {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "plugin.name": "pgoutput",
      "database.hostname": "postgres",
      "database.port": "5432",
      "database.user": "postgres",
      "database.password": "password",
      "database.dbname": "search_db",
      "database.server.name": "dbserver1",
      "topic.prefix": "dbserver1",
      "table.include.list": "public.Product",
      "publication.name": "dbz_publication",
      "slot.name": "debezium_slot_v4",
      "decimal.handling.mode": "double",
      "heartbeat.interval.ms": "5000",
      "transforms": "unwrap",
      "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
      "transforms.unwrap.drop.tombstones": "true",
      "transforms.unwrap.delete.handling.mode": "rewrite",
      "transforms.unwrap.add.fields": "op"
    }
  }'

echo ""
echo "Checking connector status..."
sleep 3
curl -s "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/status" | \
  python3 -m json.tool 2>/dev/null || \
  curl -s "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/status"
echo ""
