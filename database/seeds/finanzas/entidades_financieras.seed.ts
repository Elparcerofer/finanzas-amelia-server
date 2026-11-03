import { Pool } from 'mysql2/promise';

/**
 * Catálogo de entidades financieras del Ecuador.
 *
 * Fuentes: listados públicos de entidades controladas por la
 * Superintendencia de Bancos (bancos privados y públicos) y por la
 * Superintendencia de Economía Popular y Solidaria — SEPS (cooperativas
 * de ahorro y crédito y asociaciones mutualistas, que pasaron al control
 * de la SEPS).
 *
 * ⚠️ Cooperativas: la SEPS controla varios cientos de cooperativas en 5
 * segmentos. Acá se cargan las más grandes (segmento 1). Para cargar el
 * listado completo, descargar el catastro oficial de la SEPS y agregar
 * las filas a este arreglo (el seed no duplica: ver seedEntidadesFinancieras).
 *
 * RUC: solo se llenan los que pudimos verificar (pasan el dígito
 * verificador del SRI). El resto queda en null para completarlo desde la
 * pantalla o con el catastro del SRI — mejor vacío que un RUC inventado.
 *
 * `codigo` es la clave estable del seed: si se corrige un nombre, el seed
 * actualiza la fila existente (mismo id) en vez de crear otra, así no se
 * rompen las cuentas/tarjetas/deudas que ya apuntan a esa entidad.
 */

export type SubtipoEntidad = 'banco' | 'bancoPublico' | 'cooperativa' | 'mutualista';

export interface EntidadSeed {
  codigo: string;
  nombre: string;
  subtipo: SubtipoEntidad;
  ruc?: string;
  notas?: string;
}

const SB = 'Superintendencia de Bancos';
const SEPS = 'Superintendencia de Economía Popular y Solidaria (SEPS)';

export const REGULADOR: Record<SubtipoEntidad, string> = {
  banco: SB,
  bancoPublico: SB,
  cooperativa: SEPS,
  mutualista: SEPS,
};

export const entidadesFinancierasEcuador: EntidadSeed[] = [
  // ---------------- Bancos privados (Superintendencia de Bancos) ----------------
  { codigo: 'PICHINCHA', nombre: 'Banco Pichincha', subtipo: 'banco', ruc: '1790010937001' },
  { codigo: 'GUAYAQUIL', nombre: 'Banco Guayaquil', subtipo: 'banco', ruc: '0990049459001' },
  {
    codigo: 'PACIFICO', nombre: 'Banco del Pacífico', subtipo: 'banco', ruc: '0990005737001',
    notas: 'Accionista mayoritario: el Estado; la SB lo supervisa dentro del sistema de bancos privados.',
  },
  { codigo: 'PRODUBANCO', nombre: 'Produbanco', subtipo: 'banco' },
  { codigo: 'BOLIVARIANO', nombre: 'Banco Bolivariano', subtipo: 'banco', ruc: '0990379017001' },
  { codigo: 'INTERNACIONAL', nombre: 'Banco Internacional', subtipo: 'banco', ruc: '1790049795001' },
  { codigo: 'AUSTRO', nombre: 'Banco del Austro', subtipo: 'banco' },
  { codigo: 'RUMINAHUI', nombre: 'Banco General Rumiñahui', subtipo: 'banco' },
  { codigo: 'SOLIDARIO', nombre: 'Banco Solidario', subtipo: 'banco' },
  { codigo: 'LOJA', nombre: 'Banco de Loja', subtipo: 'banco' },
  { codigo: 'MACHALA', nombre: 'Banco de Machala', subtipo: 'banco' },
  { codigo: 'PROCREDIT', nombre: 'Banco ProCredit', subtipo: 'banco' },
  { codigo: 'DINERS', nombre: 'Banco Diners Club del Ecuador', subtipo: 'banco' },
  { codigo: 'CITIBANK', nombre: 'Citibank Ecuador', subtipo: 'banco' },
  { codigo: 'AMAZONAS', nombre: 'Banco Amazonas', subtipo: 'banco' },
  { codigo: 'COOPNACIONAL', nombre: 'Banco Coopnacional', subtipo: 'banco' },
  { codigo: 'CAPITAL', nombre: 'Banco Capital', subtipo: 'banco' },
  { codigo: 'DELBANK', nombre: 'Banco Delbank', subtipo: 'banco' },
  { codigo: 'DMIRO', nombre: 'Banco D-Miro', subtipo: 'banco' },
  { codigo: 'COMERCIALMANABI', nombre: 'Banco Comercial de Manabí', subtipo: 'banco' },
  { codigo: 'VISIONFUND', nombre: 'Banco VisionFund Ecuador', subtipo: 'banco' },
  { codigo: 'LITORAL', nombre: 'Banco del Litoral', subtipo: 'banco' },
  { codigo: 'BANCODESARROLLO', nombre: 'BanCodesarrollo', subtipo: 'banco' },

  // ---------------- Banca pública (Superintendencia de Bancos) ----------------
  { codigo: 'BANECUADOR', nombre: 'BanEcuador', subtipo: 'bancoPublico' },
  { codigo: 'BDE', nombre: 'Banco de Desarrollo del Ecuador (BDE)', subtipo: 'bancoPublico' },
  { codigo: 'CFN', nombre: 'Corporación Financiera Nacional (CFN)', subtipo: 'bancoPublico' },
  { codigo: 'BIESS', nombre: 'Banco del IESS (BIESS)', subtipo: 'bancoPublico' },

  // ---------------- Mutualistas (SEPS) ----------------
  { codigo: 'MUTPICHINCHA', nombre: 'Mutualista Pichincha', subtipo: 'mutualista' },
  { codigo: 'MUTAZUAY', nombre: 'Mutualista Azuay', subtipo: 'mutualista' },
  { codigo: 'MUTAMBATO', nombre: 'Mutualista Ambato', subtipo: 'mutualista' },
  { codigo: 'MUTIMBABURA', nombre: 'Mutualista Imbabura', subtipo: 'mutualista' },

  // ---------------- Cooperativas de ahorro y crédito, segmento 1 (SEPS) ----------------
  { codigo: 'JEP', nombre: 'Cooperativa JEP', subtipo: 'cooperativa', notas: 'Juventud Ecuatoriana Progresista' },
  { codigo: 'COOPPOLICIA', nombre: 'Cooperativa Policía Nacional', subtipo: 'cooperativa' },
  { codigo: 'JARDINAZUAYO', nombre: 'Cooperativa Jardín Azuayo', subtipo: 'cooperativa' },
  { codigo: '29OCTUBRE', nombre: 'Cooperativa 29 de Octubre', subtipo: 'cooperativa' },
  { codigo: 'ALIANZAVALLE', nombre: 'Cooperativa Alianza del Valle', subtipo: 'cooperativa' },
  { codigo: 'ANDALUCIA', nombre: 'Cooperativa Andalucía', subtipo: 'cooperativa' },
  { codigo: 'COOPROGRESO', nombre: 'Cooperativa Cooprogreso', subtipo: 'cooperativa' },
  { codigo: 'OSCUS', nombre: 'Cooperativa Oscus', subtipo: 'cooperativa' },
  { codigo: 'SANFRANCISCO', nombre: 'Cooperativa San Francisco', subtipo: 'cooperativa' },
  { codigo: 'MUSHUCRUNA', nombre: 'Cooperativa Mushuc Runa', subtipo: 'cooperativa' },
  { codigo: 'RIOBAMBA', nombre: 'Cooperativa Riobamba', subtipo: 'cooperativa' },
  { codigo: 'DAQUILEMA', nombre: 'Cooperativa Fernando Daquilema', subtipo: 'cooperativa' },
  { codigo: 'PABLOMUNOZVEGA', nombre: 'Cooperativa Pablo Muñoz Vega', subtipo: 'cooperativa' },
  { codigo: 'ATUNTAQUI', nombre: 'Cooperativa Atuntaqui', subtipo: 'cooperativa' },
  { codigo: 'COOPMEGO', nombre: 'Cooperativa Coopmego', subtipo: 'cooperativa', notas: 'Vicentina Manuel Esteban Godoy Ortega' },
  { codigo: 'TULCAN', nombre: 'Cooperativa Tulcán', subtipo: 'cooperativa' },
  { codigo: 'ELSAGRARIO', nombre: 'Cooperativa El Sagrario', subtipo: 'cooperativa' },
  { codigo: 'CHIBULEO', nombre: 'Cooperativa Chibuleo', subtipo: 'cooperativa' },
  { codigo: 'CACPECO', nombre: 'Cooperativa CACPECO', subtipo: 'cooperativa', notas: 'De la Pequeña Empresa de Cotopaxi' },
  { codigo: 'KULLKIWASI', nombre: 'Cooperativa Kullki Wasi', subtipo: 'cooperativa' },
  { codigo: 'AMBATO', nombre: 'Cooperativa Ambato', subtipo: 'cooperativa' },
  { codigo: 'CCP', nombre: 'Cooperativa CCP', subtipo: 'cooperativa', notas: 'Construcción, Comercio y Producción' },
  { codigo: '23JULIO', nombre: 'Cooperativa 23 de Julio', subtipo: 'cooperativa' },
  { codigo: 'SANTAROSA', nombre: 'Cooperativa Santa Rosa', subtipo: 'cooperativa' },
  { codigo: 'ALFONSOJARAMILLO', nombre: 'Cooperativa Alfonso Jaramillo León (CAJA)', subtipo: 'cooperativa' },
  { codigo: 'PADREJULIAN', nombre: 'Cooperativa Padre Julián Lorente', subtipo: 'cooperativa' },
  { codigo: 'CACPEPASTAZA', nombre: 'Cooperativa CACPE Pastaza', subtipo: 'cooperativa' },
  { codigo: 'ERCO', nombre: 'Cooperativa Erco', subtipo: 'cooperativa' },
  { codigo: '15ABRIL', nombre: 'Cooperativa 15 de Abril', subtipo: 'cooperativa' },
  { codigo: 'CAMARAAMBATO', nombre: 'Cooperativa Cámara de Comercio de Ambato', subtipo: 'cooperativa' },
];

/**
 * Inserta o actualiza cada entidad SIN duplicar:
 *  1. busca por (tipo='banco', codigo) y, si no, por (tipo='banco', nombre)
 *     — la collation compara sin mayúsculas ni tildes;
 *  2. si existe, actualiza nombre/subtipo/regulador/RUC conservando el id
 *     (las FK de cuentas, tarjetas y deudas siguen apuntando bien);
 *  3. si no existe, la inserta.
 * Además, los índices únicos de la migración 015 bloquean cualquier
 * duplicado que se escape.
 */
export async function seedEntidadesFinancieras(pool: Pool): Promise<{ insertadas: number; actualizadas: number }> {
  let insertadas = 0;
  let actualizadas = 0;

  for (const e of entidadesFinancierasEcuador) {
    const [filas] = await pool.query(
      `SELECT id FROM catalogos
       WHERE tipo = 'banco' AND (codigo = ? OR nombre = ?)
       ORDER BY (codigo = ?) DESC
       LIMIT 1`,
      [e.codigo, e.nombre, e.codigo],
    );
    const existente = (filas as { id: number }[])[0];

    if (existente) {
      await pool.query(
        `UPDATE catalogos SET
           nombre = ?, codigo = ?, subtipo = ?, grupo = ?, pais = 'Ecuador',
           ruc = COALESCE(?, ruc), notas = COALESCE(?, notas), activo = 1
         WHERE id = ?`,
        [e.nombre, e.codigo, e.subtipo, REGULADOR[e.subtipo], e.ruc || null, e.notas || null, existente.id],
      );
      actualizadas++;
    } else {
      await pool.query(
        `INSERT INTO catalogos (tipo, nombre, codigo, ruc, subtipo, grupo, pais, notas, activo)
         VALUES ('banco', ?, ?, ?, ?, ?, 'Ecuador', ?, 1)`,
        [e.nombre, e.codigo, e.ruc || null, e.subtipo, REGULADOR[e.subtipo], e.notas || null],
      );
      insertadas++;
    }
  }

  return { insertadas, actualizadas };
}
