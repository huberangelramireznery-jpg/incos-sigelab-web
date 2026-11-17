'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Cliente del nucleo SIA-INCOS.
 *
 * Reglas del contrato:
 *  - El login se hace contra POST /api/v1/auth/ingresar.
 *  - El token se valida LOCALMENTE (RS256) con la clave publica.
 *  - La clave publica se cachea 10 minutos.
 *  - Si el nucleo no responde, se usa la clave cacheada y se sigue en modo lectura.
 */

class SiaError extends Error {
  constructor(mensaje, opciones) {
    super(mensaje);
    const o = opciones || {};
    this.name = 'SiaError';
    this.status = o.status || 502;
    this.codigo = o.codigo || 'ERROR_INTERNO';
    this.datos = o.datos || null;
  }
}

const state = {
  publicKeyPem: null,
  publicKeyAt: 0,
  claveCacheada: false,
  ultimaValidacion: null,
};

async function fetchJson(url, opciones, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs || config.siaTimeoutMs);
  try {
    const res = await fetch(url, { ...(opciones || {}), signal: controller.signal });
    const texto = await res.text();
    let data = null;
    if (texto) {
      try {
        data = JSON.parse(texto);
      } catch (e) {
        data = texto;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function extraerPem(cuerpo) {
  if (!cuerpo) return null;
  if (typeof cuerpo === 'string') {
    return cuerpo.includes('BEGIN PUBLIC KEY') ? cuerpo : null;
  }
  if (typeof cuerpo === 'object') {
    const candidatos = [
      cuerpo.clave,
      cuerpo.publicKey,
      cuerpo.clave_publica,
      cuerpo.datos,
    ];
    for (const c of candidatos) {
      const pem = extraerPem(c);
      if (pem) return pem;
    }
  }
  return null;
}

function guardarClave(pem) {
  state.publicKeyPem = pem;
  state.publicKeyAt = Date.now();
  state.claveCacheada = true;
}

async function getPublicKeyPem(forzar) {
  const ahoraMs = Date.now();
  if (!forzar && state.publicKeyPem && ahoraMs - state.publicKeyAt < config.jwtCacheMs) {
    return state.publicKeyPem;
  }

  // 1) Endpoint de clave publica en formato PEM.
  try {
    const r = await fetchJson(config.siaUrl + '/api/v1/auth/clave-publica');
    const pem = extraerPem(r.data);
    if (pem) {
      guardarClave(pem);
      return pem;
    }
  } catch (e) {
    // Se intenta el JWKS como respaldo.
  }

  // 2) Respaldo JWKS.
  try {
    const r = await fetchJson(config.siaUrl + '/.well-known/jwks.json');
    const jwks = r.data && r.data.datos ? r.data.datos : r.data;
    const jwk = jwks && Array.isArray(jwks.keys) ? jwks.keys[0] : null;
    if (jwk) {
      const pem = crypto
        .createPublicKey({ key: jwk, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' });
      guardarClave(pem);
      return pem;
    }
  } catch (e) {
    // Sin conexion: si hay clave cacheada vencida, se usa igual.
  }

  if (state.publicKeyPem) return state.publicKeyPem;

  throw new SiaError('No se pudo obtener la clave pública del núcleo SIA.', {
    status: 503,
    codigo: 'SIN_CONEXION',
  });
}

async function login(identificador, clave) {
  let respuesta;
  try {
    respuesta = await fetchJson(config.siaUrl + '/api/v1/auth/ingresar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, clave }),
    });
  } catch (e) {
    throw new SiaError('No se pudo conectar con el núcleo SIA. Verifique su conexión.', {
      status: 503,
      codigo: 'SIN_CONEXION',
    });
  }

  const cuerpo = respuesta.data;

  if (!respuesta.ok) {
    const error = (cuerpo && cuerpo.error) || {};
    throw new SiaError(error.mensaje || 'No fue posible iniciar sesión.', {
      status: respuesta.status,
      codigo: error.codigo || 'NO_AUTENTICADO',
      datos: cuerpo,
    });
  }

  const datos = cuerpo && cuerpo.datos !== undefined ? cuerpo.datos : cuerpo;
  const token = datos && (datos.token || datos.jwt || datos.access_token);
  const persona = (datos && (datos.persona || datos.usuario)) || null;

  if (!token) {
    throw new SiaError('El núcleo no devolvió un token válido.', {
      status: 502,
      codigo: 'ERROR_INTERNO',
    });
  }

  return { token, persona, datos };
}

function verificarCon(pem, token) {
  return jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: config.emisor,
    clockTolerance: 30,
  });
}

async function verifyToken(token) {
  let pem = await getPublicKeyPem();
  let ultimoError = null;
  let payload = null;

  try {
    payload = verificarCon(pem, token);
  } catch (e) {
    // Si la clave estaba cacheada, puede haber rotado en el nucleo:
    // se fuerza una actualizacion y se reintenta una sola vez.
    ultimoError = e;
    if (state.claveCacheada) {
      try {
        pem = await getPublicKeyPem(true);
        payload = verificarCon(pem, token);
        ultimoError = null;
      } catch (e2) {
        ultimoError = e2;
      }
    }
  }

  if (payload) {
    state.ultimaValidacion = {
      valida: true,
      emisor: config.emisor,
      cuando: new Date().toISOString(),
    };
    return payload;
  }

  state.ultimaValidacion = {
    valida: false,
    emisor: config.emisor,
    cuando: new Date().toISOString(),
    motivo: ultimoError ? ultimoError.message : 'Token inválido',
  };

  if (ultimoError && ultimoError.name === 'TokenExpiredError') {
    throw new SiaError('El token expiró. Vuelva a ingresar.', {
      status: 401,
      codigo: 'TOKEN_EXPIRADO',
    });
  }
  throw new SiaError('Token inválido.', {
    status: 401,
    codigo: 'TOKEN_INVALIDO',
  });
}

let estadoCache = { valor: 'SIN_CONEXION', at: 0 };

async function estadoNucleo(forzar) {
  const ahoraMs = Date.now();
  if (!forzar && ahoraMs - estadoCache.at < config.estadoCacheMs) {
    return estadoCache.valor;
  }
  let valor = 'SIN_CONEXION';
  try {
    const r = await fetchJson(config.siaUrl + '/api/v1/estado', {}, 5000);
    if (r.ok) valor = 'CONECTADO';
  } catch (e) {
    valor = 'SIN_CONEXION';
  }
  estadoCache = { valor, at: Date.now() };
  return valor;
}

async function getConToken(rutaRelativa, token) {
  return fetchJson(config.siaUrl + rutaRelativa, {
    headers: { Authorization: 'Bearer ' + token },
  });
}

function usuarioDesdeToken(payload) {
  if (!payload) return null;
  return {
    persona_id: Number(payload.sub),
    ci: payload.ci || '',
    nombre:
      payload.nombre ||
      [payload.nombres, payload.apellidos].filter(Boolean).join(' '),
    roles: payload.roles || {},
    cargos: payload.cargos || [],
  };
}

function estadoJwt() {
  // Si hubo una verificacion explicita, manda ese resultado.
  // Si aun no se verifico ningun token, se reporta si la clave publica esta disponible.
  return {
    valida: state.ultimaValidacion
      ? Boolean(state.ultimaValidacion.valida)
      : Boolean(state.claveCacheada),
    emisor: config.emisor,
    claveCacheada: state.claveCacheada,
  };
}

module.exports = {
  SiaError,
  login,
  verifyToken,
  estadoNucleo,
  getConToken,
  usuarioDesdeToken,
  estadoJwt,
  getPublicKeyPem,
};
