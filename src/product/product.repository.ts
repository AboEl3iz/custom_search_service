import db from '../db/postgres';

export interface Product {
    id: number;
    title: string;
    description?: string;
    brand?: string;
    category?: string;
    price: number;
    stock: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface CreateProductDto {
    title: string;
    description?: string;
    brand?: string;
    category?: string;
    price?: number;
    stock?: number;
}

export interface UpdateProductDto {
    title?: string;
    description?: string;
    brand?: string;
    category?: string;
    price?: number;
    stock?: number;
}

/**
 * All write operations go to PostgreSQL.
 * CDC is handled automatically: Debezium reads the WAL (Write-Ahead Log) and
 * publishes events to Kafka. The Search Service Kafka consumer then syncs
 * those changes to Elasticsearch. No manual outbox writes are needed here.
 */
export class ProductRepository {

    async findAll(page = 1, limit = 20): Promise<{ data: Product[]; total: number }> {
        const offset = (page - 1) * limit;
        const [dataResult, countResult] = await Promise.all([
            db.query<Product>(
                `SELECT id, title, description, brand, category, price, stock, created_at, updated_at
         FROM "Product"
         ORDER BY id DESC
         LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
            db.query<{ count: string }>('SELECT COUNT(*) FROM "Product"'),
        ]);
        return {
            data: dataResult.rows,
            total: parseInt(countResult.rows[0].count, 10),
        };
    }

    async findById(id: number): Promise<Product | null> {
        const result = await db.query<Product>(
            `SELECT id, title, description, brand, category, price, stock, created_at, updated_at
       FROM "Product" WHERE id = $1`,
            [id]
        );
        return result.rows[0] ?? null;
    }

    async create(dto: CreateProductDto): Promise<Product> {
        const result = await db.query<Product>(
            `INSERT INTO "Product" (title, description, brand, category, price, stock, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, title, description, brand, category, price, stock, created_at, updated_at`,
            [
                dto.title,
                dto.description ?? null,
                dto.brand ?? null,
                dto.category ?? null,
                dto.price ?? 0,
                dto.stock ?? 0,
            ]
        );
        // Debezium picks up this INSERT from the WAL and streams it to Kafka → ES
        return result.rows[0];
    }

    async update(id: number, dto: UpdateProductDto): Promise<Product | null> {
        // Build dynamic SET clause for partial updates
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (dto.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(dto.title); }
        if (dto.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(dto.description); }
        if (dto.brand !== undefined) { fields.push(`brand = $${paramIndex++}`); values.push(dto.brand); }
        if (dto.category !== undefined) { fields.push(`category = $${paramIndex++}`); values.push(dto.category); }
        if (dto.price !== undefined) { fields.push(`price = $${paramIndex++}`); values.push(dto.price); }
        if (dto.stock !== undefined) { fields.push(`stock = $${paramIndex++}`); values.push(dto.stock); }

        if (fields.length === 0) return this.findById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query<Product>(
            `UPDATE "Product"
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, title, description, brand, category, price, stock, created_at, updated_at`,
            values
        );
        // Debezium picks up this UPDATE from the WAL and streams it to Kafka → ES
        return result.rows[0] ?? null;
    }

    async delete(id: number): Promise<boolean> {
        const result = await db.query(
            `DELETE FROM "Product" WHERE id = $1`,
            [id]
        );
        // Debezium picks up this DELETE from the WAL and streams it to Kafka → ES
        return (result.rowCount ?? 0) > 0;
    }
}

export const productRepository = new ProductRepository();
