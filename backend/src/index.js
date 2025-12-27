import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import authRoutes from './routes/auth.js';
import repairRoutes from './routes/repair.js';
import clientsRoutes from './routes/clients.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Health check (before rate limiting - called frequently for connection check)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiting (after health check, skip /health)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.nodeEnv === 'development' ? 500 : config.rateLimit.max,
  message: { error: 'Demasiadas solicitudes, intente más tarde' },
  skip: (req) => req.path === '/health',
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/repair', repairRoutes);
app.use('/api/clients', clientsRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`QRaxer API running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
