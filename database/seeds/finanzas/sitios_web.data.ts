/**
 * Sitio web de las entidades y empresas del catálogo semilla — de aquí
 * sale el logo automático (ícono público del sitio) mientras el usuario
 * no suba uno propio. Dominios tomados del prototipo "Solvenza"
 * (finanzasPrototipo-catalogos-deudas.html, WEB_ENT / WEB_EMP), con los
 * nombres tal como quedaron en la BD.
 *
 * Solo se llena `web` cuando está vacío (ver migración 017): nunca pisa
 * lo que el usuario haya editado desde la pantalla.
 */

export const WEB_ENTIDADES: Record<string, string> = {
  'Banco Amazonas': 'bancoamazonas.com',
  'Banco Bolivariano': 'bolivariano.com',
  'Banco Coopnacional': 'coopnacional.com',
  'Banco D-Miro': 'bancodmiro.com.ec',
  'Banco de Loja': 'bancodeloja.fin.ec',
  'Banco de Machala': 'bancomachala.com',
  'Banco del Austro': 'bancodelaustro.com',
  'Banco del IESS (BIESS)': 'biess.fin.ec',
  'Banco del Pacífico': 'bancodelpacifico.com',
  'Banco Diners Club del Ecuador': 'dinersclub.com.ec',
  'Banco General Rumiñahui': 'bgr.com.ec',
  'Banco Guayaquil': 'bancoguayaquil.com',
  'Banco Internacional': 'bancointernacional.com.ec',
  'Banco Pichincha': 'pichincha.com',
  'Banco ProCredit': 'bancoprocredit.com.ec',
  'Banco Solidario': 'banco-solidario.com',
  'Banco VisionFund Ecuador': 'visionfund.ec',
  BanCodesarrollo: 'bancodesarrollo.fin.ec',
  BanEcuador: 'banecuador.fin.ec',
  'Citibank Ecuador': 'citibank.com',
  'Cooperativa 29 de Octubre': '29deoctubre.fin.ec',
  'Cooperativa Alianza del Valle': 'alianzadelvalle.fin.ec',
  'Cooperativa Ambato': 'coopambato.fin.ec',
  'Cooperativa Andalucía': 'andalucia.com.ec',
  'Cooperativa Atuntaqui': 'atuntaqui.fin.ec',
  'Cooperativa CACPECO': 'cacpeco.com',
  'Cooperativa Chibuleo': 'chibuleo.com',
  'Cooperativa Cooprogreso': 'cooprogreso.fin.ec',
  'Cooperativa Fernando Daquilema': 'coopdaquilema.com',
  'Cooperativa Jardín Azuayo': 'jardinazuayo.fin.ec',
  'Cooperativa JEP': 'coopjep.fin.ec',
  'Cooperativa Mushuc Runa': 'mushucruna.com',
  'Cooperativa Oscus': 'oscus.coop',
  'Cooperativa Pablo Muñoz Vega': 'cpmv.fin.ec',
  'Cooperativa Policía Nacional': 'cpn.fin.ec',
  'Cooperativa Riobamba': 'cooprio.fin.ec',
  'Cooperativa San Francisco': 'coac-sanfra.com',
  'Cooperativa Santa Rosa': 'coopsantarosa.fin.ec',
  'Cooperativa Tulcán': 'cooptulcan.com',
  'Corporación Financiera Nacional (CFN)': 'cfn.fin.ec',
  'Mutualista Azuay': 'mutualistaazuay.com',
  'Mutualista Pichincha': 'mutualistapichincha.com',
  Produbanco: 'produbanco.com.ec',
};

export const WEB_EMPRESAS: Record<string, string> = {
  'Claro Ecuador': 'claro.com.ec',
  'CNT (Telefonía/Internet)': 'cnt.com.ec',
  'Movistar Ecuador': 'movistar.com.ec',
};
