# Backend - Finanzas Movile Amelia

API en Node.js + TypeScript + Express + PostgreSQL para el módulo de finanzas personales de la app Amelia.

## Requisitos

- Node.js 18+
- PostgreSQL 13+

## Instalación

```bash
npm install
cp .env .env.local   # ajustar credenciales si aplica
npm run migrate
npm run seed
npm run dev
```

## Estructura

- `controllers/finanzas` — manejadores HTTP por recurso.
- `services/finanzas` — lógica de negocio.
- `models/finanzas` — acceso a datos (PostgreSQL).
- `routes/finanzas` — definición de endpoints, agrupados en `routes/finanzas/index.ts`.
- `schema/finanzas` — validación de payloads con Joi.
- `middlewares` — autenticación, validación, manejo de errores, rate limit, CORS.
- `database/migrations/finanzas` — creación de tablas.
- `database/seeds/finanzas` — datos iniciales (bancos/empresas/categorías de Ecuador).
- `utils/finanzas` — validadores (cédula/teléfono EC), formatters, constantes.
- `plugins/finanzas` — integraciones adicionales (notificaciones).

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Levanta el servidor en modo desarrollo con recarga automática |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta el build compilado |
| `npm run lint` | Corre TSLint |
| `npm run migrate` | Ejecuta las migraciones de finanzas |
| `npm run seed` | Carga los datos iniciales de catálogos |
