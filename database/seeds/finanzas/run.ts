import pool from '../../pool';
import { seedEmpresas } from './entidades_empresas.seed';
import { seedEntidadesFinancieras } from './entidades_financieras.seed';
import { seedCategorias } from './categorias.seed';

async function ejecutar(): Promise<void> {
  const entidades = await seedEntidadesFinancieras(pool);
  console.log(`Entidades financieras: ${entidades.insertadas} insertadas, ${entidades.actualizadas} actualizadas`);
  await seedEmpresas(pool);
  await seedCategorias(pool);
  console.log('Seeds de finanzas aplicados correctamente');
  await pool.end();
}

ejecutar().catch((error) => {
  console.error('Error ejecutando seeds:', error);
  process.exit(1);
});
