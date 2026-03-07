import dotenv from 'dotenv';
dotenv.config();

import { productRepository } from '../product/product.repository';

const products = [
  // Phones
  { title: 'iPhone 15 Pro Max', description: 'Apple flagship with A17 Pro chip, titanium frame, 48MP camera', brand: 'Apple', category: 'Phones', price: 1199.99, stock: 50 },
  { title: 'iPhone 15 Pro', description: 'Apple smartphone with A17 Pro chip and USB-C', brand: 'Apple', category: 'Phones', price: 999.99, stock: 80 },
  { title: 'iPhone 15', description: 'Apple smartphone with A16 chip and Dynamic Island', brand: 'Apple', category: 'Phones', price: 799.99, stock: 120 },
  { title: 'iPhone 14', description: 'Apple smartphone previous generation, great value', brand: 'Apple', category: 'Phones', price: 599.99, stock: 60 },
  { title: 'Samsung Galaxy S24 Ultra', description: 'Android flagship with S Pen, 200MP camera', brand: 'Samsung', category: 'Phones', price: 1299.99, stock: 40 },
  { title: 'Samsung Galaxy S24+', description: 'Samsung flagship with Snapdragon 8 Gen 3', brand: 'Samsung', category: 'Phones', price: 999.99, stock: 55 },
  { title: 'Samsung Galaxy S24', description: 'Compact Samsung flagship 2024', brand: 'Samsung', category: 'Phones', price: 799.99, stock: 70 },
  { title: 'Samsung Galaxy A54', description: 'Mid-range Samsung with AMOLED display', brand: 'Samsung', category: 'Phones', price: 449.99, stock: 100 },
  { title: 'Google Pixel 8 Pro', description: 'Google AI-powered phone with Tensor G3 chip', brand: 'Google', category: 'Phones', price: 999.99, stock: 45 },
  { title: 'Google Pixel 8', description: 'Google phone with 7 years of OS updates', brand: 'Google', category: 'Phones', price: 699.99, stock: 65 },
  { title: 'OnePlus 12', description: 'Fast charging flagship killer from OnePlus', brand: 'OnePlus', category: 'Phones', price: 799.99, stock: 35 },

  // Laptops
  { title: 'MacBook Pro 16 M3 Max', description: 'Apple laptop with M3 Max chip, 128GB unified memory', brand: 'Apple', category: 'Laptops', price: 3999.99, stock: 20 },
  { title: 'MacBook Pro 14 M3 Pro', description: 'Apple laptop with M3 Pro, perfect for developers', brand: 'Apple', category: 'Laptops', price: 1999.99, stock: 30 },
  { title: 'MacBook Air M2', description: 'Thin and light Apple laptop with fanless design', brand: 'Apple', category: 'Laptops', price: 1099.99, stock: 55 },
  { title: 'MacBook Air M3', description: 'Latest MacBook Air with M3 chip, 2x faster WiFi', brand: 'Apple', category: 'Laptops', price: 1299.99, stock: 45 },
  { title: 'Dell XPS 15', description: 'Premium Dell laptop with OLED display, Intel Core i9', brand: 'Dell', category: 'Laptops', price: 1799.99, stock: 25 },
  { title: 'Dell XPS 13', description: 'Ultra-portable Dell InfinityEdge laptop', brand: 'Dell', category: 'Laptops', price: 1199.99, stock: 35 },
  { title: 'Lenovo ThinkPad X1 Carbon', description: 'Business ultrabook, 12th Gen Intel, 1kg', brand: 'Lenovo', category: 'Laptops', price: 1499.99, stock: 28 },
  { title: 'ASUS ROG Zephyrus G14', description: 'Gaming laptop with AMD Ryzen 9, RTX 4060', brand: 'ASUS', category: 'Laptops', price: 1599.99, stock: 22 },
  { title: 'HP Spectre x360 14', description: 'Convertible laptop with OLED touchscreen', brand: 'HP', category: 'Laptops', price: 1399.99, stock: 30 },

  // Tablets
  { title: 'iPad Pro 12.9 M2', description: 'Apple flagship tablet with M2 chip and Liquid Retina XDR', brand: 'Apple', category: 'Tablets', price: 1099.99, stock: 40 },
  { title: 'iPad Air M1', description: 'Apple slim tablet with M1 chip and USB-C', brand: 'Apple', category: 'Tablets', price: 599.99, stock: 60 },
  { title: 'iPad mini 6', description: 'Apple compact tablet with A15 chip', brand: 'Apple', category: 'Tablets', price: 499.99, stock: 50 },
  { title: 'Samsung Galaxy Tab S9 Ultra', description: 'Large Android tablet with AMOLED display and S Pen', brand: 'Samsung', category: 'Tablets', price: 1199.99, stock: 25 },
  { title: 'Samsung Galaxy Tab S9', description: 'Android tablet with Snapdragon 8 Gen 2', brand: 'Samsung', category: 'Tablets', price: 799.99, stock: 35 },

  // Accessories
  { title: 'AirPods Pro 2nd Gen', description: 'Apple earbuds with active noise cancellation', brand: 'Apple', category: 'Accessories', price: 249.99, stock: 150 },
  { title: 'AirPods Max', description: 'Apple over-ear headphones with spatial audio', brand: 'Apple', category: 'Accessories', price: 549.99, stock: 40 },
  { title: 'Samsung Galaxy Buds2 Pro', description: 'Samsung earbuds with 360° audio', brand: 'Samsung', category: 'Accessories', price: 229.99, stock: 80 },
  { title: 'Sony WH-1000XM5', description: 'Best-in-class noise cancelling headphones', brand: 'Sony', category: 'Accessories', price: 399.99, stock: 60 },
  { title: 'Apple Watch Ultra 2', description: 'Rugged Apple Watch for extreme sports', brand: 'Apple', category: 'Accessories', price: 799.99, stock: 30 },
];

async function seed() {
  console.log('🌱 Starting seed...');
  let created = 0;

  for (const p of products) {
    await productRepository.create(p);
    created++;
    process.stdout.write(`\r   ${created}/${products.length} products inserted...`);
  }

  console.log(`\n✅ Seeded ${created} products into PostgreSQL.`);
  console.log('🔄 CDC poller will sync them to Elasticsearch within 1-2 seconds.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
