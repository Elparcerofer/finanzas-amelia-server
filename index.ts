import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { corsMiddleware } from './middlewares/cors.middleware';
import { rateLimitMiddleware } from './middlewares/rateLimit.middleware';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import finanzasRoutes from './routes/finanzas';

dotenv.config();

const app = express();

app.use(helmet());
app.use(corsMiddleware);
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimitMiddleware);

app.get('/health', (_req, res) => {
  res.json({ estado: 'ok' });
});

app.use('/api/finanzas', finanzasRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
