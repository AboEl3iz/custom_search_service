import express, { Express } from 'express';
import searchRoutes from './routes/search.routes';
import productRoutes from './product/product.routes';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// Search always goes to Elasticsearch (read model)
app.use('/api/search', searchRoutes);

// Product CRUD — writes to PostgreSQL, CDC poller syncs to ES
app.use('/api/products', productRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok the app is healthy', timestamp: new Date().toISOString() });
});



export default app;

// Global error handler for malformed JSON and other synchronous errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ status: 'error', message: 'Invalid JSON payload' });
  }
  console.error('Unhandled Error:', err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});
