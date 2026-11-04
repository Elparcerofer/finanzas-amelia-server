import { Pool } from 'mysql2/promise';
import logos from './logos_catalogo.data.json';

/**
 * Logos de las entidades y empresas del catálogo semilla (65 de 66),
 * optimizados a PNG 128×128 (mismo formato que sube la app):
 *  - 17 son exactamente los que muestra la maqueta "Solvenza".
 *  - Donde la maqueta solo muestra el relleno gris de DuckDuckGo ("no
 *    encontrado") o iniciales, se usa el logo oficial obtenido de:
 *      · el ícono declarado en su sitio oficial (apple-touch-icon,
 *        icon, manifest, favicon.svg);
 *      · el símbolo del logo de su encabezado (logos anchos recortados
 *        al isotipo para que se lea a 40 px);
 *      · el ícono de su app oficial (Google Play / App Store) cuando el
 *        sitio bloquea accesos automatizados (El Sagrario, Mutualista
 *        Ambato, Mutualista Azuay);
 *      · el archivo subido por el propio banco a Wikimedia (D-Miro).
 *    Banco del Litoral: su ícono es blanco, va sobre su color de marca
 *    (#0b2c4d, theme-color de su sitio).
 *  - Sin logo: Cooperativa CCP (fusionada con la 23 de Julio en 2021,
 *    sin sitio propio) → la app muestra las iniciales.
 *
 * Solo llena `logo` donde está vacío: nunca pisa uno subido por el usuario.
 */
export async function seedLogosCatalogo(pool: Pool): Promise<number> {
  let actualizados = 0;
  for (const [nombre, dataUri] of Object.entries(logos as Record<string, string>)) {
    const [r] = await pool.query(
      "UPDATE catalogos SET logo = ? WHERE tipo IN ('banco', 'empresa') AND nombre = ? AND (logo IS NULL OR logo = '')",
      [dataUri, nombre],
    );
    actualizados += (r as { affectedRows: number }).affectedRows;
  }
  return actualizados;
}

/**
 * Sitios oficiales verificados con búsqueda web (nov. 2026). Corrige los
 * dominios que traía la maqueta y no existen, y completa los que faltaban.
 * Solo cambia `web` si está vacío o si todavía tiene el dominio viejo
 * que puso el seed (no pisa lo que haya editado el usuario).
 */
const SITIOS_OFICIALES: Record<string, { web: string; anterior?: string }> = {
  'Banco Coopnacional': { web: 'https://www.bancocoopnacional.com', anterior: 'https://coopnacional.com' },
  'Banco D-Miro': { web: 'https://www.d-miro.com', anterior: 'https://bancodmiro.com.ec' },
  'Cooperativa Ambato': { web: 'https://cooperativaambato.fin.ec', anterior: 'https://coopambato.fin.ec' },
  'Cooperativa Andalucía': { web: 'https://andalucia.fin.ec', anterior: 'https://andalucia.com.ec' },
  'Cooperativa Santa Rosa': { web: 'https://www.coopacs.fin.ec', anterior: 'https://coopsantarosa.fin.ec' },
  'Cooperativa Tulcán': { web: 'https://www.cooptulcan.fin.ec', anterior: 'https://cooptulcan.com' },
  'Banco del Litoral': { web: 'https://www.bancodellitoral.com' },
  'Banco Capital': { web: 'https://www.bancocapital.com' },
  'Banco Comercial de Manabí': { web: 'https://www.bcmanabi.com' },
  'Banco de Desarrollo del Ecuador (BDE)': { web: 'https://bde.fin.ec' },
  'Banco Delbank': { web: 'https://www.delbank.fin.ec' },
  'Cooperativa 15 de Abril': { web: 'https://www.coop15abril.fin.ec' },
  'Cooperativa 23 de Julio': { web: 'https://www.coop23dejulio.fin.ec' },
  'Cooperativa Alfonso Jaramillo León (CAJA)': { web: 'https://www.caja.com.ec' },
  'Cooperativa CACPE Pastaza': { web: 'https://www.cacpepas.fin.ec' },
  'Cooperativa Cámara de Comercio de Ambato': { web: 'https://www.ccca.fin.ec' },
  'Cooperativa Coopmego': { web: 'https://mego.com.ec' },
  'Cooperativa El Sagrario': { web: 'https://www.elsagrario.fin.ec' },
  'Cooperativa Erco': { web: 'https://www.cooperco.fin.ec' },
  'Cooperativa Kullki Wasi': { web: 'https://www.kullkiwasi.com.ec' },
  'Cooperativa Padre Julián Lorente': { web: 'https://www.lorente.fin.ec' },
  'Mutualista Ambato': { web: 'https://www.mutualistaambato.fin.ec' },
  'Mutualista Imbabura': { web: 'https://www.mutualistaimbabura.com' },
  'CNEL (Electricidad)': { web: 'https://www.cnelep.gob.ec' },
  'EMAAP-Q (Agua potable Quito)': { web: 'https://www.aguaquito.gob.ec' },
};

export async function seedSitiosOficiales(pool: Pool): Promise<number> {
  let actualizados = 0;
  for (const [nombre, { web, anterior }] of Object.entries(SITIOS_OFICIALES)) {
    const [r] = await pool.query(
      `UPDATE catalogos SET web = ?
       WHERE tipo IN ('banco', 'empresa') AND nombre = ? AND (web IS NULL OR web = '' OR web = ?)`,
      [web, nombre, anterior ?? ''],
    );
    actualizados += (r as { affectedRows: number }).affectedRows;
  }
  return actualizados;
}
