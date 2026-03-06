import {
    productRepository,
    CreateProductDto,
    UpdateProductDto,
    Product,
} from './product.repository';

export class ProductService {
    async getAll(
        page?: number,
        limit?: number
    ): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
        const p = Math.max(1, page ?? 1);
        const l = Math.min(100, Math.max(1, limit ?? 20));
        const result = await productRepository.findAll(p, l);
        return { ...result, page: p, limit: l };
    }

    async getById(id: number): Promise<Product | null> {
        return productRepository.findById(id);
    }

    async create(dto: CreateProductDto): Promise<Product> {
        if (!dto.title?.trim()) {
            throw new Error('Product title is required');
        }
        return productRepository.create(dto);
    }

    async update(id: number, dto: UpdateProductDto): Promise<Product | null> {
        return productRepository.update(id, dto);
    }

    async delete(id: number): Promise<boolean> {
        return productRepository.delete(id);
    }
}

export const productService = new ProductService();
