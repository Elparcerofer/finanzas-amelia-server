import pool from '../../pool';
import * as m001 from './001_create_catalogos';
import * as m002 from './002_create_cuentas';
import * as m003 from './003_create_tarjetas_credito';
import * as m004 from './004_create_deudas';
import * as m005 from './005_create_tablas_amortizacion';
import * as m006 from './006_create_cuotas_amortizacion';
import * as m007 from './007_create_estados_cuenta';
import * as m008 from './008_create_pagos';
import * as m009 from './009_create_consumos';
import * as m010 from './010_create_consumos_tarjeta';
import * as m011 from './011_create_ingresos';
import * as m012 from './012_create_perfiles';
import * as m013 from './013_create_eventos_calendario';
import * as m014 from './014_create_notificaciones_internas';
import * as m015 from './015_entidades_ruc_unicos';
import * as m016 from './016_marcas_categorias_tarjeta';
import * as m017 from './017_logos_web_origen_tabla';
import * as m018 from './018_paga_con_color_categoria';
import * as m019 from './019_revision_diseno_bd';
import * as m020 from './020_pagos_motor_obligaciones';
import * as m021 from './021_ingresos_fuentes';
import * as m022 from './022_categorias_sistema';
import * as m023 from './023_conciliaciones_tarjeta';

const migraciones = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023];

async function ejecutar(): Promise<void> {
  for (const migracion of migraciones) {
    await migracion.up(pool);
  }
  console.log(`Migraciones de finanzas aplicadas: ${migraciones.length}`);
  await pool.end();
}

ejecutar().catch((error) => {
  console.error('Error ejecutando migraciones:', error);
  process.exit(1);
});
