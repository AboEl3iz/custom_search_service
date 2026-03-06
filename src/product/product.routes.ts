import { Router } from 'express';
import {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
} from './product.controller';

const router = Router();

// GET  /api/products          — paginated list (reads from PostgreSQL)
router.get('/', getAllProducts);

// GET  /api/products/:id      — single product (reads from PostgreSQL)
router.get('/:id', getProductById);

// POST /api/products          — create → PG write + outbox → CDC → ES
router.post('/', createProduct);

// PUT  /api/products/:id      — update → PG write + outbox → CDC → ES
router.put('/:id', updateProduct);

// DELETE /api/products/:id   — delete → PG write + outbox → CDC → ES
router.delete('/:id', deleteProduct);

export default router;
