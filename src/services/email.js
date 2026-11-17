'use strict';

/**
 * Envio de codigos por correo.
 *
 * - Si SMTP esta configurado, usa Gmail/Google Workspace via nodemailer.
 * - Si no, funciona en modo demostracion: imprime el codigo en la consola
 *   y el frontend lo muestra en pantalla (AUTH_DEMO_CODES=true).
 */

const nodemailer = require('nodemailer');
const config = require('../config');

let transporte = null;

function estaConfigurado() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

function obtenerTransporte() {
  if (!estaConfigurado()) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporte;
}

function plantilla(codigo, nombre, tipo) {
  const titulo =
    tipo === 'RECUPERAR_CLAVE'
      ? 'Recuperación de contraseña'
      : 'Verificación de cuenta';
  const saludo = nombre ? 'Hola ' + nombre + ',' : 'Hola,';
  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f3f6fb;padding:24px">' +
    '<div style="background:#0f766e;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">' +
    '<h1 style="margin:0;font-size:20px">SIGELAB-INCOS</h1>' +
    '<p style="margin:6px 0 0;opacity:.85;font-size:13px">Laboratorios e inventario</p>' +
    '</div>' +
    '<div style="background:#fff;padding:26px 24px;border:1px solid #e3e8f0;border-top:none;border-radius:0 0 14px 14px">' +
    '<p style="margin:0 0 10px;color:#16202b">' + saludo + '</p>' +
    '<p style="margin:0 0 18px;color:#475467">' + titulo + '. Use este código de 4 dígitos:</p>' +
    '<div style="text-align:center;margin:22px 0">' +
    '<span style="display:inline-block;font-size:34px;letter-spacing:12px;font-weight:800;color:#0f766e;background:#f0fdfa;border:1px dashed #14b8a6;border-radius:12px;padding:12px 22px 12px 34px">' +
    codigo +
    '</span></div>' +
    '<p style="margin:0;color:#667085;font-size:13px">El código vence en 10 minutos. Si no solicitó este código, ignore este mensaje.</p>' +
    '</div>' +
    '<p style="text-align:center;color:#98a2b3;font-size:12px;margin-top:14px">SIGELAB-INCOS · Instituto Técnico INCOS-BENI</p>' +
    '</div>'
  );
}

async function enviarCodigo(destino, codigo, nombre, tipo) {
  const t = obtenerTransporte();
  if (!t) {
    if (!config.authDemoCodes) {
      throw new Error('El envío de correo no está configurado (SMTP).');
    }
    console.log('[SIGELAB][DEMO][EMAIL] Código para ' + destino + ': ' + codigo);
    return { enviado: false, modo: 'DEMO' };
  }

  try {
    await t.sendMail({
      from: config.smtp.from || config.smtp.user,
      to: destino,
      subject: 'SIGELAB-INCOS · Código ' + codigo,
      text: 'Su código SIGELAB es ' + codigo + '. Vence en 10 minutos.',
      html: plantilla(codigo, nombre, tipo),
    });
    return { enviado: true, modo: 'SMTP' };
  } catch (e) {
    console.error('[SIGELAB] Error enviando correo:', e.message);
    if (config.authDemoCodes) {
      console.log('[SIGELAB][DEMO][EMAIL] Código para ' + destino + ': ' + codigo);
      return { enviado: false, modo: 'DEMO_FALLBACK', error: e.message };
    }
    throw e;
  }
}

module.exports = { estaConfigurado, enviarCodigo };
