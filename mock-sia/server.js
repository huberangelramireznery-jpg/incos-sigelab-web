'use strict';

/**
 * SIA-INCOS simulado (solo para desarrollo y demostracion).
 * Implementa el contrato v1 que consume el SIGELAB:
 *   - login con JWT RS256
 *   - clave publica y JWKS
 *   - personas y cargos
 *   - diagnostico /api/v1/estado
 *
 * Cuentas ficticias del Anexo B del Contrato de Conformidad v1.1.0.
 * Contrasena unica: Demo2026*
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

// Cargar el .env del proyecto (solo para el puerto del mock).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PUERTO = Number(process.env.MOCK_SIA_PORT || 3000);
const EMISOR = 'sia-incos';
const CLAVE_DEMO = 'Demo2026*';

// ------------------------------------------------------------------
// Par de claves RSA (se regenera en cada arranque del simulador)
// ------------------------------------------------------------------
const { publicKey: CLAVE_PUBLICA, privateKey: CLAVE_PRIVADA } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const JWK = crypto.createPublicKey(CLAVE_PUBLICA).export({ format: 'jwk' });
JWK.kid = 'sia-incos-demo-1';
JWK.use = 'sig';
JWK.alg = 'RS256';

// ------------------------------------------------------------------
// Datos ficticios
// ------------------------------------------------------------------
const PERSONAS = [
  {
    id: 1,
    ci: '9000001',
    nombres: 'Ana María',
    apellidos: 'Rojas Vaca',
    correo_electronico: 'ana.rojas@incos.demo',
    tipo: 'ADMINISTRATIVO',
    estado: 'ACTIVO',
    roles: { SIA: 'ADMINISTRATIVO', SGC: 'ADMINISTRATIVO', SGPA: 'ADMINISTRATIVO', SIGELAB: 'ADMINISTRATIVO', BUZON: 'ADMINISTRATIVO' },
    cargos: ['Rector'],
  },
  {
    id: 2,
    ci: '9000002',
    nombres: 'Carlos Eduardo',
    apellidos: 'Méndez Suárez',
    correo_electronico: 'carlos.mendez@incos.demo',
    tipo: 'ADMINISTRATIVO',
    estado: 'ACTIVO',
    roles: { SIA: 'ADMINISTRATIVO', SGC: 'ADMINISTRATIVO', SGPA: 'ADMINISTRATIVO', SIGELAB: 'ADMINISTRATIVO', BUZON: 'ADMINISTRATIVO' },
    cargos: ['Académico'],
  },
  {
    id: 3,
    ci: '9000003',
    nombres: 'María Elena',
    apellidos: 'Chávez Ortiz',
    correo_electronico: 'maria.chavez@incos.demo',
    tipo: 'ADMINISTRATIVO',
    estado: 'ACTIVO',
    roles: { SIA: 'ADMINISTRATIVO', SGC: 'ADMINISTRATIVO' },
    cargos: ['Administrativo'],
  },
  {
    id: 4,
    ci: '9000004',
    nombres: 'Rosa Irene',
    apellidos: 'Limpias Cuéllar',
    correo_electronico: 'rosa.limpias@incos.demo',
    tipo: 'SERVICIO',
    estado: 'ACTIVO',
    roles: { SIA: 'SERVICIO', SGC: 'SERVICIO' },
    cargos: ['Secretaría'],
  },
  {
    id: 5,
    ci: '9000005',
    nombres: 'Juan Pablo',
    apellidos: 'Quiroga Salas',
    correo_electronico: 'juan.quiroga@incos.demo',
    tipo: 'ADMINISTRATIVO',
    estado: 'ACTIVO',
    roles: {},
    cargos: [],
  },
  {
    id: 6,
    ci: '9000006',
    nombres: 'Luis Fernando',
    apellidos: 'Añez Rivero',
    correo_electronico: 'luis.anez@incos.demo',
    tipo: 'ADMINISTRATIVO',
    estado: 'ACTIVO',
    roles: { SIA: 'ADMINISTRATIVO', SIGELAB: 'ADMINISTRATIVO' },
    cargos: ['Encargado de Laboratorios'],
  },
  {
    id: 7,
    ci: '9000007',
    nombres: 'Patricia',
    apellidos: 'Gutiérrez Nazareno',
    correo_electronico: 'patricia.gutierrez@incos.demo',
    tipo: 'SERVICIO',
    estado: 'ACTIVO',
    roles: { SIA: 'SERVICIO', SIGELAB: 'SERVICIO' },
    cargos: ['Técnico de Laboratorio'],
  },
  {
    id: 8,
    ci: '9000008',
    nombres: 'Jorge Antonio',
    apellidos: 'Villarroel Peña',
    correo_electronico: 'jorge.villarroel@incos.demo',
    tipo: 'DOCENTE',
    estado: 'ACTIVO',
    roles: { SIA: 'DOCENTE', SGC: 'DOCENTE', SGPA: 'DOCENTE' },
    cargos: ['Docente'],
  },
  {
    id: 16,
    ci: '9000016',
    nombres: 'Lucía',
    apellidos: 'Mamani Quispe',
    correo_electronico: 'lucia.mamani@incos.demo',
    tipo: 'ESTUDIANTE',
    estado: 'ACTIVO',
    roles: { SIA: 'ESTUDIANTE', SGPA: 'ESTUDIANTE' },
    cargos: ['Estudiante'],
  },
];

const CARGOS = [
  { id: 1, nombre: 'Rector', es_autoridad: true },
  { id: 2, nombre: 'Académico', es_autoridad: true },
  { id: 3, nombre: 'Administrativo', es_autoridad: false },
  { id: 4, nombre: 'Secretaría', es_autoridad: false },
  { id: 5, nombre: 'Encargado de Laboratorios', es_autoridad: false },
  { id: 6, nombre: 'Técnico de Laboratorio', es_autoridad: false },
  { id: 7, nombre: 'Docente', es_autoridad: false },
  { id: 8, nombre: 'Estudiante', es_autoridad: false },
];

const CARRERAS = [
  { id: 1, nombre: 'Ingeniería de Sistemas', regimen: 'SEMESTRAL', estado: 'ACTIVA' },
  { id: 2, nombre: 'Ingeniería Informática', regimen: 'SEMESTRAL', estado: 'ACTIVA' },
];

function personaMinima(p) {
  return {
    id: p.id,
    ci: p.ci,
    nombres: p.nombres,
    apellidos: p.apellidos,
    nombre_completo: p.nombres + ' ' + p.apellidos,
    correo_electronico: p.correo_electronico,
    tipo: p.tipo,
    estado: p.estado,
    cargos: p.cargos,
  };
}

function ok(res, datos, meta, status) {
  return res.status(status || 200).json({
    exito: true,
    datos: datos === undefined ? null : datos,
    meta: meta || null,
    error: null,
  });
}

function fail(res, status, codigo, mensaje) {
  return res.status(status).json({
    exito: false,
    datos: null,
    meta: null,
    error: { codigo, mensaje },
  });
}

function horaBolivia(fecha) {
  const base = fecha ? new Date(fecha) : new Date();
  const d = new Date(base.getTime() - 4 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '-04:00'
  );
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ------------------------------------------------------------------
// Rutas publicas de diagnostico
// ------------------------------------------------------------------
app.get('/health', (req, res) => {
  return res.json({ estado: 'ok', sistema: 'SIA-INCOS', baseDatos: 'simulada', hora: horaBolivia() });
});

app.get('/api/v1/estado', (req, res) => {
  return ok(res, {
    sistema: 'SIA-INCOS',
    version: '1.1.0-simulado',
    estado: 'OPERATIVO',
    entorno: 'SIMULADOR_LOCAL',
    hora: horaBolivia(),
  });
});

// ------------------------------------------------------------------
// Autenticacion
// ------------------------------------------------------------------
app.post('/api/v1/auth/ingresar', (req, res) => {
  const { identificador, clave } = req.body || {};
  if (!identificador || !clave) {
    return fail(res, 400, 'DATOS_INVALIDOS', 'Debe enviar identificador y clave.');
  }

  const texto = String(identificador).trim().toLowerCase();
  const persona = PERSONAS.find(
    (p) => p.ci === texto || String(p.correo_electronico).toLowerCase() === texto
  );

  if (!persona || clave !== CLAVE_DEMO) {
    return fail(res, 401, 'NO_AUTENTICADO', 'Cédula/correo o contraseña incorrectos.');
  }
  if (persona.estado !== 'ACTIVO') {
    return fail(res, 403, 'CUENTA_INACTIVA', 'La cuenta está inactiva.');
  }

  const token = jwt.sign(
    {
      iss: EMISOR,
      sub: String(persona.id),
      ci: persona.ci,
      nombre: persona.nombres + ' ' + persona.apellidos,
      roles: persona.roles,
      cargos: persona.cargos,
    },
    CLAVE_PRIVADA,
    { algorithm: 'RS256', expiresIn: '8h', jwtid: crypto.randomUUID() }
  );

  return ok(res, {
    token,
    persona: {
      id: persona.id,
      ci: persona.ci,
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      correo_electronico: persona.correo_electronico,
      tipo: persona.tipo,
      roles: persona.roles,
      cargos: persona.cargos,
    },
  });
});

app.get('/api/v1/auth/clave-publica', (req, res) => {
  return ok(res, { clave: CLAVE_PUBLICA, formato: 'PEM', algoritmo: 'RS256' });
});

app.get('/.well-known/jwks.json', (req, res) => {
  return res.json({ keys: [JWK] });
});

// ------------------------------------------------------------------
// Middleware de autenticacion para el resto de endpoints
// ------------------------------------------------------------------
function requiereToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Bearer ')) {
    return fail(res, 401, 'NO_AUTENTICADO', 'Falta la cabecera Authorization: Bearer <token>.');
  }
  const token = cabecera.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, CLAVE_PUBLICA, { algorithms: ['RS256'], issuer: EMISOR });
    req.identidad = payload;
    return next();
  } catch (e) {
    const codigo = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO';
    return fail(res, 401, codigo, 'El token no es válido.');
  }
}

// ------------------------------------------------------------------
// Personas y cargos
// ------------------------------------------------------------------
app.get('/api/v1/personas', requiereToken, (req, res) => {
  const { tipo, q } = req.query;
  let lista = PERSONAS.slice();
  if (tipo) lista = lista.filter((p) => p.tipo === String(tipo).toUpperCase());
  if (q) {
    const texto = String(q).toLowerCase();
    lista = lista.filter((p) =>
      [p.ci, p.nombres, p.apellidos, p.correo_electronico]
        .join(' ')
        .toLowerCase()
        .includes(texto)
    );
  }
  const pagina = Number(req.query.pagina || 1);
  const porPagina = 20;
  const total = lista.length;
  lista = lista.slice((pagina - 1) * porPagina, pagina * porPagina);
  return ok(res, lista.map(personaMinima), { pagina, total, por_pagina: porPagina });
});

app.get('/api/v1/personas/por-ci/:ci', requiereToken, (req, res) => {
  const persona = PERSONAS.find((p) => p.ci === String(req.params.ci));
  if (!persona) return fail(res, 404, 'NO_ENCONTRADO', 'La persona no existe.');
  return ok(res, personaMinima(persona));
});

app.get('/api/v1/personas/:id/cargos', requiereToken, (req, res) => {
  const persona = PERSONAS.find((p) => String(p.id) === String(req.params.id));
  if (!persona) return fail(res, 404, 'NO_ENCONTRADO', 'La persona no existe.');
  const cargos = persona.cargos.map((nombre) => {
    const base = CARGOS.find((c) => c.nombre === nombre) || { id: null, es_autoridad: false };
    return {
      id: base.id,
      nombre,
      es_autoridad: base.es_autoridad,
      fecha_inicio: '2026-01-01',
      fecha_fin: null,
      vigente: true,
    };
  });
  return ok(res, cargos);
});

app.get('/api/v1/personas/:id', requiereToken, (req, res) => {
  const persona = PERSONAS.find((p) => String(p.id) === String(req.params.id));
  if (!persona) return fail(res, 404, 'NO_ENCONTRADO', 'La persona no existe.');
  return ok(res, personaMinima(persona));
});

app.get('/api/v1/cargos', requiereToken, (req, res) => {
  let lista = CARGOS.slice();
  if (req.query.autoridad === 'true') lista = lista.filter((c) => c.es_autoridad);
  return ok(res, lista);
});

app.get('/api/v1/carreras', requiereToken, (req, res) => {
  return ok(res, CARRERAS);
});

app.get('/api/v1/gestiones/actual', requiereToken, (req, res) => {
  return ok(res, { id: 1, anio: 2026, periodo: 'II', activa: true });
});

app.use('/api', (req, res) => {
  return fail(res, 404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada en el simulador.');
});

app.use((err, req, res, next) => {
  console.error('[MOCK-SIA] Error:', err);
  return fail(res, 500, 'ERROR_INTERNO', 'Error interno del simulador.');
});

app.listen(PUERTO, () => {
  console.log('====================================================');
  console.log('  SIA-INCOS · Simulador local del núcleo');
  console.log('====================================================');
  console.log('  URL:      http://127.0.0.1:' + PUERTO);
  console.log('  Estado:   http://127.0.0.1:' + PUERTO + '/api/v1/estado');
  console.log('  Login:    POST /api/v1/auth/ingresar');
  console.log('  Clave:    ' + CLAVE_DEMO);
  console.log('  Cuentas:  9000001 ... 9000016 (ver README)');
  console.log('====================================================');
});
