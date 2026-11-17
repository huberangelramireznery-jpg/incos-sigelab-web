'use strict';

/**
 * Autenticacion local del SIGELAB.
 *
 * El SIA sigue siendo el proveedor institucional. Este modulo agrega
 * cuentas SIGELAB opcionales para el demo:
 *   - registro con Gmail + telefono
 *   - codigo de 4 digitos por correo y por WhatsApp
 *   - recuperacion de contrasena
 *
 * Las contrasenas se guardan con scrypt (sal aleatoria). Los codigos
 * se guardan como HMAC-SHA256, nunca en texto plano.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../db');
const email = require('./email');
const whatsapp = require('./whatsapp');

const ISSUER = 'sigelab-local';
const AUDIENCE = 'sigelab';

const TIPOS = {
  VERIFICAR_CORREO: 'VERIFICAR_CORREO',
  VERIFICAR_TELEFONO: 'VERIFICAR_TELEFONO',
  RECUPERAR_CLAVE: 'RECUPERAR_CLAVE',
};

const CANALES = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
};

class LocalAuthError extends Error {
  constructor(codigo, mensaje, status) {
    super(mensaje);
    this.name = 'LocalAuthError';
    this.codigo = codigo || 'DATOS_INVALIDOS';
    this.status = status || 400;
  }
}

// ------------------------------------------------------------------
// Secreto para firmar sesiones locales.
// No se versiona: se genera una vez en data/local-jwt-secret.
// ------------------------------------------------------------------

function cargarSecreto() {
  if (process.env.JWT_LOCAL_SECRET) return process.env.JWT_LOCAL_SECRET;

  const archivo = path.join(__dirname, '..', '..', 'data', 'local-jwt-secret');
  try {
    if (fs.existsSync(archivo)) {
      const guardado = fs.readFileSync(archivo, 'utf8').trim();
      if (guardado) return guardado;
    }
    const nuevo = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, nuevo, { encoding: 'utf8', mode: 0o600 });
    return nuevo;
  } catch (e) {
    // Ultimo recurso: las sesiones se invalidan al reiniciar el proceso.
    console.warn('[SIGELAB] No se pudo guardar el secreto local:', e.message);
    return crypto.randomBytes(48).toString('hex');
  }
}

const SECRETO = cargarSecreto();

// ------------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------------

function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

function esCorreoGoogle(correo) {
  return /^[a-z0-9._%+-]+@(gmail\.com|googlemail\.com)$/i.test(String(correo || ''));
}

function normalizarTelefono(telefono) {
  let valor = String(telefono || '').trim().replace(/[^\d+]/g, '');
  if (!valor) return '';

  if (valor.startsWith('00')) valor = '+' + valor.slice(2);
  if (!valor.startsWith('+')) {
    if (/^591\d{8}$/.test(valor)) valor = '+' + valor;
    else if (/^\d{8}$/.test(valor)) valor = '+591' + valor;
    else valor = '+' + valor.replace(/\D/g, '');
  }

  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 8 || digitos.length > 15) return '';
  return '+' + digitos;
}

function validarNombre(nombre) {
  const valor = String(nombre || '').trim();
  if (valor.length < 3) return 'Ingrese su nombre completo.';
  if (valor.length > 120) return 'El nombre es demasiado largo.';
  return null;
}

function validarClave(clave) {
  const valor = String(clave || '');
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Za-z]/.test(valor) || !/\d/.test(valor)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  return null;
}

// ------------------------------------------------------------------
// Contrasenas
// ------------------------------------------------------------------

function hashPassword(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(clave), sal, 64).toString('hex');
  return 'scrypt$' + sal + '$' + hash;
}

function verificarPassword(clave, almacenado) {
  try {
    const partes = String(almacenado || '').split('$');
    if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
    const esperado = Buffer.from(partes[2], 'hex');
    const calculado = crypto.scryptSync(String(clave), partes[1], 64);
    return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
  } catch (e) {
    return false;
  }
}

// ------------------------------------------------------------------
// Codigos
// ------------------------------------------------------------------

function generarCodigo() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function hashCodigo(codigo, usuarioId, tipo, canal) {
  return crypto
    .createHmac('sha256', SECRETO)
    .update([String(codigo), String(usuarioId), String(tipo), String(canal)].join(':'))
    .digest('hex');
}

function mismoHash(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch (e) {
    return false;
  }
}

async function crearCodigo(user, tipo, canal) {
  const codigo = generarCodigo();
  const previo = await store.getCodigo(user.id, tipo, canal);
  await store.upsertCodigo({
    usuario_id: user.id,
    tipo,
    canal,
    destino: canal === CANALES.EMAIL ? user.correo : user.telefono,
    codigo_hash: hashCodigo(codigo, user.id, tipo, canal),
    expira_en: new Date(Date.now() + config.authCodigoExpiraMs).toISOString(),
    envios: previo ? Number(previo.envios || 1) + 1 : 1,
  });
  return codigo;
}

async function enviarCodigo(user, tipo, canal) {
  const codigo = await crearCodigo(user, tipo, canal);
  const resultado =
    canal === CANALES.EMAIL
      ? await email.enviarCodigo(user.correo, codigo, user.nombre_completo, tipo)
      : await whatsapp.enviarCodigo(user.telefono, codigo, user.nombre_completo, tipo);
  return { codigo, resultado };
}

async function validarCodigo(user, tipo, canal, codigo) {
  const registro = await store.getCodigo(user.id, tipo, canal);
  if (!registro) {
    throw new LocalAuthError('CODIGO_INVALIDO', 'Solicite un código nuevo.', 400);
  }
  if (registro.usado_en) {
    throw new LocalAuthError('CODIGO_USADO', 'El código ya fue utilizado.', 400);
  }
  if (new Date(registro.expira_en).getTime() < Date.now()) {
    throw new LocalAuthError('CODIGO_EXPIRADO', 'El código expiró. Solicite uno nuevo.', 400);
  }
  if (Number(registro.intentos) >= config.authCodigoMaxIntentos) {
    throw new LocalAuthError('CODIGO_BLOQUEADO', 'Demasiados intentos. Solicite un código nuevo.', 429);
  }

  const esperado = hashCodigo(String(codigo).trim(), user.id, tipo, canal);
  if (!mismoHash(esperado, registro.codigo_hash)) {
    await store.updateCodigo(user.id, tipo, canal, {
      intentos: Number(registro.intentos || 0) + 1,
    });
    throw new LocalAuthError('CODIGO_INVALIDO', 'El código no es correcto.', 400);
  }

  await store.updateCodigo(user.id, tipo, canal, {
    usado_en: new Date().toISOString(),
  });
  return true;
}

// ------------------------------------------------------------------
// Sesiones locales
// ------------------------------------------------------------------

function crearToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      nombre: user.nombre_completo,
      correo: user.correo,
      telefono: user.telefono,
      roles: { SIGELAB: user.rol || 'CONSULTA' },
      cargos: cargosDeRol(user.rol),
      origen: 'LOCAL',
      tv: Number(user.token_version) || 0,
    },
    SECRETO,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: config.localJwtExpira,
    }
  );
}

function cargosDeRol(rol) {
  if (rol === 'ADMINISTRATIVO') return ['Encargado de Laboratorios'];
  if (rol === 'SERVICIO') return ['Técnico de Laboratorio'];
  return ['Consulta'];
}

function esTokenLocal(token) {
  try {
    const payload = jwt.decode(token);
    return Boolean(payload && payload.iss === ISSUER);
  } catch (e) {
    return false;
  }
}

async function validarTokenLocal(token) {
  let payload;
  try {
    payload = jwt.verify(token, SECRETO, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (e) {
    if (e && e.name === 'TokenExpiredError') {
      throw new LocalAuthError('TOKEN_EXPIRADO', 'La sesión expiró. Vuelva a ingresar.', 401);
    }
    throw new LocalAuthError('TOKEN_INVALIDO', 'Token inválido.', 401);
  }

  const user = await store.getUsuarioLocal(payload.sub);
  if (!user || !user.activo) {
    throw new LocalAuthError('CUENTA_INACTIVA', 'La cuenta está inactiva.', 401);
  }
  if (Number(payload.tv) !== Number(user.token_version || 0)) {
    throw new LocalAuthError('TOKEN_INVALIDO', 'La sesión ya no es válida. Vuelva a ingresar.', 401);
  }

  return {
    persona_id: Number(user.persona_id),
    ci: '',
    nombre: user.nombre_completo,
    roles: { SIGELAB: user.rol || 'CONSULTA' },
    cargos: cargosDeRol(user.rol),
    correo: user.correo,
    telefono: user.telefono,
    origen: 'LOCAL',
    usuario_id: user.id,
  };
}

function datosPublicos(user) {
  return {
    usuario_id: user.id,
    nombre_completo: user.nombre_completo,
    correo: user.correo,
    telefono: user.telefono,
    rol: user.rol,
    activo: Boolean(user.activo),
    correo_verificado: Boolean(user.correo_verificado),
    telefono_verificado: Boolean(user.telefono_verificado),
  };
}

// ------------------------------------------------------------------
// Flujos
// ------------------------------------------------------------------

async function registrar(datos) {
  const nombre = String(datos.nombre_completo || '').trim();
  const correo = normalizarCorreo(datos.correo);
  const telefono = normalizarTelefono(datos.telefono);
  const clave = String(datos.clave || '');
  const confirmar = String(datos.confirmar_clave || '');

  const errorNombre = validarNombre(nombre);
  if (errorNombre) throw new LocalAuthError('DATOS_INVALIDOS', errorNombre, 400);

  if (!esCorreoGoogle(correo)) {
    throw new LocalAuthError(
      'CORREO_NO_GOOGLE',
      'Use un correo real de Google (@gmail.com).',
      400
    );
  }

  if (!telefono) {
    throw new LocalAuthError(
      'TELEFONO_INVALIDO',
      'Ingrese un número de WhatsApp válido con código de país. Ej: +591 71234567.',
      400
    );
  }

  const errorClave = validarClave(clave);
  if (errorClave) throw new LocalAuthError('CLAVE_DEBIL', errorClave, 400);
  if (clave !== confirmar) {
    throw new LocalAuthError('CLAVES_DISTINTAS', 'Las contraseñas no coinciden.', 400);
  }

  // En modo real no se crea una cuenta que no podra verificarse.
  if (!config.authDemoCodes) {
    if (!email.estaConfigurado()) {
      throw new LocalAuthError(
        'CORREO_NO_CONFIGURADO',
        'El envío de correo no está configurado. Contacte al administrador.',
        503
      );
    }
    if (!whatsapp.estaConfigurado()) {
      throw new LocalAuthError(
        'WHATSAPP_NO_CONFIGURADO',
        'El envío por WhatsApp no está configurado. Contacte al administrador.',
        503
      );
    }
  }

  const existente = await store.getUsuarioLocalPorCorreo(correo);

  if (existente && existente.activo) {
    throw new LocalAuthError(
      'REGISTRO_DUPLICADO',
      'Ya existe una cuenta activa con ese correo. Inicie sesión o use "¿Olvidaste tu contraseña?".',
      400
    );
  }

  let user;
  if (existente && !existente.activo) {
    // Si la cuenta quedó sin verificar, permitir reenviar los códigos y
    // actualizar los datos en lugar de bloquear el registro.
    const porTelefono = await store.getUsuarioLocalPorTelefono(telefono);
    if (porTelefono && Number(porTelefono.id) !== Number(existente.id)) {
      throw new LocalAuthError(
        'REGISTRO_DUPLICADO',
        'Ese teléfono ya está registrado en otra cuenta.',
        400
      );
    }
    user = await store.updateUsuarioLocal(existente.id, {
      nombre_completo: nombre,
      telefono,
      password_hash: hashPassword(clave),
      activo: false,
    });
  } else {
    user = await store.createUsuarioLocal({
      nombre_completo: nombre,
      correo,
      telefono,
      password_hash: hashPassword(clave),
      rol: 'CONSULTA',
      activo: false,
    });
  }

  if (!user) {
    throw new LocalAuthError('ERROR_INTERNO', 'No fue posible crear la cuenta.', 500);
  }

  // Cache de nombre para que historial y auditoria muestren el nombre.
  await store.upsertCachePersona({
    persona_id: user.persona_id,
    ci: '',
    nombre_completo: user.nombre_completo,
    cargo: 'Cuenta local SIGELAB',
  });

  let envioCorreo;
  try {
    envioCorreo = await enviarCodigo(user, TIPOS.VERIFICAR_CORREO, CANALES.EMAIL);
  } catch (e) {
    console.error('[SIGELAB] Error enviando el código de correo:', e.message);
    throw new LocalAuthError(
      'ENVIO_CORREO_FALLIDO',
      'La cuenta fue creada, pero no se pudo enviar el código al correo. Intente registrarse nuevamente para reenviarlo.',
      502
    );
  }

  let envioWhatsapp;
  try {
    envioWhatsapp = await enviarCodigo(user, TIPOS.VERIFICAR_TELEFONO, CANALES.WHATSAPP);
  } catch (e) {
    // El correo es el canal que activa la cuenta. Si WhatsApp falla, no se
    // bloquea el registro: el usuario puede reenviar el código más tarde.
    console.error('[SIGELAB] Error enviando el código de WhatsApp:', e.message);
    envioWhatsapp = {
      codigo: null,
      resultado: { enviado: false, modo: 'ERROR', error: e.message },
    };
  }

  return {
    usuario: datosPublicos(user),
    envios: {
      correo: {
        enviado: envioCorreo.resultado.enviado,
        modo: envioCorreo.resultado.modo,
        destino: user.correo,
      },
      whatsapp: {
        enviado: envioWhatsapp.resultado.enviado,
        modo: envioWhatsapp.resultado.modo,
        destino: user.telefono,
      },
    },
    demo: config.authDemoCodes
      ? { correo: envioCorreo.codigo, whatsapp: envioWhatsapp.codigo }
      : null,
  };
}

async function verificarCodigo(usuarioId, canal, codigo) {
  const user = await store.getUsuarioLocal(usuarioId);
  if (!user) throw new LocalAuthError('NO_ENCONTRADO', 'La cuenta no existe.', 404);

  const canalNorm = String(canal || '').toUpperCase();

  if (canalNorm === CANALES.EMAIL) {
    await validarCodigo(user, TIPOS.VERIFICAR_CORREO, CANALES.EMAIL, codigo);
    const actualizado = await store.updateUsuarioLocal(user.id, {
      correo_verificado: true,
      activo: true,
      token_version: Number(user.token_version || 0) + 1,
    });
    return { usuario: datosPublicos(actualizado), activo: true };
  }

  if (canalNorm === CANALES.WHATSAPP) {
    await validarCodigo(user, TIPOS.VERIFICAR_TELEFONO, CANALES.WHATSAPP, codigo);
    const actualizado = await store.updateUsuarioLocal(user.id, {
      telefono_verificado: true,
    });
    return { usuario: datosPublicos(actualizado), activo: Boolean(actualizado.activo) };
  }

  throw new LocalAuthError('CANAL_INVALIDO', 'Canal de verificación inválido.', 400);
}

async function reenviarCodigo(usuarioId, canal, tipo) {
  const canalNorm = String(canal || '').toUpperCase();
  if (canalNorm !== CANALES.EMAIL && canalNorm !== CANALES.WHATSAPP) {
    throw new LocalAuthError('CANAL_INVALIDO', 'Canal de envío inválido.', 400);
  }

  if (!config.authDemoCodes) {
    if (canalNorm === CANALES.EMAIL && !email.estaConfigurado()) {
      throw new LocalAuthError(
        'CORREO_NO_CONFIGURADO',
        'El envío de correo no está configurado.',
        503
      );
    }
    if (canalNorm === CANALES.WHATSAPP && !whatsapp.estaConfigurado()) {
      throw new LocalAuthError(
        'WHATSAPP_NO_CONFIGURADO',
        'El envío por WhatsApp no está configurado.',
        503
      );
    }
  }

  const user = await store.getUsuarioLocal(usuarioId);
  if (!user) throw new LocalAuthError('NO_ENCONTRADO', 'La cuenta no existe.', 404);

  const tipoNorm = String(tipo || 'VERIFICAR').toUpperCase();
  let tipoCodigo;
  if (tipoNorm === 'RECUPERAR') tipoCodigo = TIPOS.RECUPERAR_CLAVE;
  else if (canalNorm === CANALES.EMAIL) tipoCodigo = TIPOS.VERIFICAR_CORREO;
  else tipoCodigo = TIPOS.VERIFICAR_TELEFONO;

  const previo = await store.getCodigo(user.id, tipoCodigo, canalNorm);
  if (previo && Date.now() - new Date(previo.ultimo_envio_en).getTime() < config.authCodigoReenvioMs) {
    throw new LocalAuthError('ESPERAR', 'Espere un minuto antes de solicitar otro código.', 429);
  }
  if (previo && Number(previo.envios || 0) >= config.authCodigoMaxPorHora) {
    throw new LocalAuthError('LIMITE', 'Se alcanzó el límite de códigos. Intente más tarde.', 429);
  }

  const envio = await enviarCodigo(user, tipoCodigo, canalNorm);
  return {
    envio: {
      enviado: envio.resultado.enviado,
      modo: envio.resultado.modo,
      destino: canalNorm === CANALES.EMAIL ? user.correo : user.telefono,
    },
    demo: config.authDemoCodes ? { codigo: envio.codigo } : null,
  };
}

async function solicitarRecuperacion(identificador, canal) {
  const valor = String(identificador || '').trim();
  const canalNorm = String(canal || '').toUpperCase();

  if (!valor) throw new LocalAuthError('DATOS_INVALIDOS', 'Ingrese su correo o teléfono.', 400);
  if (canalNorm !== CANALES.EMAIL && canalNorm !== CANALES.WHATSAPP) {
    throw new LocalAuthError('CANAL_INVALIDO', 'Seleccione correo o WhatsApp.', 400);
  }

  if (!config.authDemoCodes) {
    if (canalNorm === CANALES.EMAIL && !email.estaConfigurado()) {
      throw new LocalAuthError(
        'CORREO_NO_CONFIGURADO',
        'El envío de correo no está configurado.',
        503
      );
    }
    if (canalNorm === CANALES.WHATSAPP && !whatsapp.estaConfigurado()) {
      throw new LocalAuthError(
        'WHATSAPP_NO_CONFIGURADO',
        'El envío por WhatsApp no está configurado.',
        503
      );
    }
  }

  const user = valor.includes('@')
    ? await store.getUsuarioLocalPorCorreo(valor)
    : await store.getUsuarioLocalPorTelefono(normalizarTelefono(valor));

  const generico = { enviado: true, canal: canalNorm, modo: 'GENERICO', demo: null };

  if (!user || !user.activo) return generico;
  if (canalNorm === CANALES.EMAIL && !user.correo) return generico;
  if (canalNorm === CANALES.WHATSAPP && !user.telefono) return generico;

  let envio;
  try {
    envio = await enviarCodigo(user, TIPOS.RECUPERAR_CLAVE, canalNorm);
  } catch (e) {
    console.error('[SIGELAB] No se pudo enviar el código de recuperación:', e.message);
    return generico;
  }

  // En modo real la respuesta debe ser identica exista o no la cuenta.
  if (!config.authDemoCodes) return generico;

  return {
    enviado: true,
    canal: canalNorm,
    modo: envio.resultado.modo,
    demo: { codigo: envio.codigo, usuario_id: user.id },
  };
}

async function restablecer(identificador, canal, codigo, nuevaClave, confirmarClave) {
  const valor = String(identificador || '').trim();
  const canalNorm = String(canal || '').toUpperCase();

  const errorClave = validarClave(nuevaClave);
  if (errorClave) throw new LocalAuthError('CLAVE_DEBIL', errorClave, 400);
  if (String(nuevaClave) !== String(confirmarClave)) {
    throw new LocalAuthError('CLAVES_DISTINTAS', 'Las contraseñas no coinciden.', 400);
  }

  const user = valor.includes('@')
    ? await store.getUsuarioLocalPorCorreo(valor)
    : await store.getUsuarioLocalPorTelefono(normalizarTelefono(valor));

  if (!user) throw new LocalAuthError('CODIGO_INVALIDO', 'El código no es correcto.', 400);

  await validarCodigo(user, TIPOS.RECUPERAR_CLAVE, canalNorm, codigo);
  const actualizado = await store.updateUsuarioLocal(user.id, {
    password_hash: hashPassword(nuevaClave),
    token_version: Number(user.token_version || 0) + 1,
  });
  return { usuario: datosPublicos(actualizado) };
}

async function loginLocal(identificador, clave) {
  const valor = String(identificador || '').trim();
  if (!valor || !clave) {
    throw new LocalAuthError('DATOS_INVALIDOS', 'Ingrese su correo o teléfono y su contraseña.', 400);
  }

  const user = valor.includes('@')
    ? await store.getUsuarioLocalPorCorreo(valor)
    : await store.getUsuarioLocalPorTelefono(normalizarTelefono(valor));

  if (!user || !verificarPassword(clave, user.password_hash)) {
    throw new LocalAuthError(
      'NO_AUTENTICADO',
      'Correo/teléfono o contraseña incorrectos.',
      401
    );
  }

  if (!user.activo) {
    throw new LocalAuthError(
      'CUENTA_INACTIVA',
      'La cuenta aún no está verificada. Revise el código enviado a su correo.',
      403
    );
  }

  const actualizado = await store.updateUsuarioLocal(user.id, {
    ultimo_acceso: new Date().toISOString(),
  });

  const usuario = {
    persona_id: Number(user.persona_id),
    ci: '',
    nombre: user.nombre_completo,
    roles: { SIGELAB: user.rol || 'CONSULTA' },
    cargos: cargosDeRol(user.rol),
    correo: user.correo,
    telefono: user.telefono,
    origen: 'LOCAL',
    usuario_id: user.id,
  };

  return { token: crearToken(actualizado), usuario };
}

module.exports = {
  LocalAuthError,
  TIPOS,
  CANALES,
  registrar,
  verificarCodigo,
  reenviarCodigo,
  solicitarRecuperacion,
  restablecer,
  loginLocal,
  esTokenLocal,
  validarTokenLocal,
  normalizarCorreo,
  normalizarTelefono,
  esCorreoGoogle,
};
