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
// 1 MB: el logo (data URI ~128×128) y una tabla de amortización de
// hasta 480 cuotas no caben en los 100 KB por defecto.
// El PDF del estado de cuenta llega en base64 (hasta ~10 MB): esa ruta
// se parsea antes con un límite mayor; el resto sigue con 1 MB.
app.use(/^\/api\/finanzas\/consumos\/deuda\/\d+\/conciliacion\/[\d-]+\/pdf$/, express.json({ limit: '15mb' }));
app.use(express.json({ limit: '1mb' }));
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
