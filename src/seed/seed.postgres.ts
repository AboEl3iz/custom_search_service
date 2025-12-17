import db from "../db/postgres";

const products = [
  {
    title: "iPhone 15 Pro",
    description: "Apple smartphone with A17 chip",
    brand: "Apple",
    category: "phones",
  },
  {
    title: "iPhone 15",
    description: "Apple smartphone with A16 chip",
    brand: "Apple",
    category: "phones",
  },
  {
    title: "iPhone 14",
    description: "Apple smartphone previous generation",
    brand: "Apple",
    category: "phones",
  },
  {
    title: "Samsung Galaxy S24 Ultra",
    description: "Android flagship phone",
    brand: "Samsung",
    category: "phones",
  },
  {
    title: "Samsung Galaxy S23",
    description: "Previous Samsung flagship",
    brand: "Samsung",
    category: "phones",
  },
  {
    title: "MacBook Pro 16",
    description: "Apple laptop with M2 Pro",
    brand: "Apple",
    category: "laptops",
  },
  {
    title: "MacBook Air M2",
    description: "Apple light laptop",
    brand: "Apple",
    category: "laptops",
  },
];

async function seedPostgres() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS "Product" (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        brand TEXT,
        category TEXT
      )
    `);
    await db.query('DELETE FROM "Product";'); // clean table first
    for (const p of products) {
      await db.query(
        `INSERT INTO "Product" (title, description, brand, category)
         VALUES ($1, $2, $3, $4)`,
        [p.title, p.description, p.brand, p.category]
      );
    }
    console.log("✅ PostgreSQL seeded");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

seedPostgres();
