import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../backend/src/routes/auth.js';
import repairRoutes from '../backend/src/routes/repair.js';
import { errorHandler } from '../backend/src/middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins in serverless
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/repair', repairRoutes);

// Error handling
app.use(errorHandler);

export default app;
