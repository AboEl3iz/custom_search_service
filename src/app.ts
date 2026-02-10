import express, { Express } from 'express';
import searchRoutes from './routes/search.routes';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Show which container is handling the request (for load balancer demo)
app.get('/whoami', (req, res) => {
  const hostname = require('os').hostname();
  res.json({
    container: hostname,
    timestamp: new Date().toISOString(),
    message: 'This request was handled by container: ' + hostname
  });
});

export default app;
