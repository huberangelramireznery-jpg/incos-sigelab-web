'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Configuracion central del demo SIGELAB-INCOS.
 * Toda direccion y puerto se lee del entorno (regla del contrato).
 */
const config = {
  // Identidad del sistema (debe coincidir con la clave del claim roles)
  sistema: 'SIGELAB',
  version: '1.0.0',

  // Servidor del demo
  port: parseInt(process.env.PORT || '4100', 10),

  // Nucleo SIA-INCOS (sin barra final)
  siaUrl: (process.env.API_ACADEMICO_URL || 'http://127.0.0.1:3000').replace(/\/+$/, ''),

  // Emisor esperado del JWT
  emisor: 'sia-incos',

  // Almacenamiento propio: auto | firestore | file
  dbBackend: (process.env.DB_BACKEND || 'auto').toLowerCase(),

  // Zona horaria oficial del ecosistema
  timezone: 'America/La_Paz',

  // Cache de la clave publica: 10 minutos (contrato 5.1)
  jwtCacheMs: 10 * 60 * 1000,

  // Cache del diagnostico del nucleo (evita golpear el SIA en cada request)
  estadoCacheMs: 10 * 1000,

  // Regla de negocio del SIGELAB (informativa segun la guia)
  maxEquiposPorSala: 20,

  // Timeout de llamadas al SIA
  siaTimeoutMs: parseInt(process.env.SIA_TIMEOUT_MS || '8000', 10),
};

module.exports = config;
