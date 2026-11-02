import pool from '../../pool';
import { seedEntidadesEmpresas } from './entidades_empresas.seed';
import { seedCategorias } from './categorias.seed';

async function ejecutar(): Promise<void> {
  await seedEntidadesEmpresas(pool);
  await seedCategorias(pool);
  console.log('Seeds de finanzas aplicados correctamente');
  await pool.end();
}

ejecutar().catch((error) => {
  console.error('Error ejecutando seeds:', error);
  process.exit(1);
});
