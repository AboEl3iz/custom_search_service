import { Request, Response } from 'express';
import { productService } from './product.service';

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await productService.getAll(page, limit);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

        const product = await productService.getById(id);
        if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

        res.json(product);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const product = await productService.create(req.body);
        res.status(201).json(product);
    } catch (err: any) {
        const status = err.message.includes('required') ? 400 : 500;
        res.status(status).json({ error: err.message });
    }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

        const product = await productService.update(id, req.body);
        if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

        res.json(product);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

        const deleted = await productService.delete(id);
        if (!deleted) { res.status(404).json({ error: 'Product not found' }); return; }

        res.status(204).send();
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
