'use strict';

/**
 * Envio de codigos por WhatsApp.
 *
 * Proveedores soportados:
 *   - twilio: API REST de Twilio (sandbox o numero aprobado).
 *   - meta:   WhatsApp Cloud API de Meta.
 *   - demo:   imprime el codigo en consola y el frontend lo muestra.
 */

const config = require('../config');

function estaConfigurado() {
  const w = config.whatsapp;
  if (w.provider === 'twilio') {
    return Boolean(w.twilioSid && w.twilioToken && w.twilioFrom);
  }
  if (w.provider === 'meta') {
    return Boolean(w.metaToken && w.metaPhoneId);
  }
  return false;
}

function mensaje(codigo) {
  return (
    'SIGELAB-INCOS: su código de verificación es ' +
    codigo +
    '. Vence en 10 minutos. No lo comparta con nadie.'
  );
}

async function enviarTwilio(destino, codigo) {
  const w = config.whatsapp;
  const sid = w.twilioSid;
  const cuerpo = new URLSearchParams({
    From: 'whatsapp:' + w.twilioFrom,
    To: 'whatsapp:' + destino,
    Body: mensaje(codigo),
  });

  const res = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + w.twilioToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: cuerpo.toString(),
    }
  );

  if (!res.ok) {
    const texto = await res.text();
    throw new Error('Twilio ' + res.status + ': ' + texto.slice(0, 240));
  }
}

async function enviarMeta(destino, codigo) {
  const w = config.whatsapp;
  const url =
    'https://graph.facebook.com/' +
    w.metaVersion +
    '/' +
    encodeURIComponent(w.metaPhoneId) +
    '/messages';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + w.metaToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destino.replace(/\D/g, ''),
      type: 'text',
      text: { body: mensaje(codigo) },
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error('Meta WhatsApp ' + res.status + ': ' + texto.slice(0, 240));
  }
}

async function enviarCodigo(destino, codigo, nombre, tipo) {
  if (!estaConfigurado()) {
    if (!config.authDemoCodes) {
      throw new Error('El envío por WhatsApp no está configurado.');
    }
    console.log('[SIGELAB][DEMO][WHATSAPP] Código para ' + destino + ': ' + codigo);
    return { enviado: false, modo: 'DEMO' };
  }

  try {
    if (config.whatsapp.provider === 'twilio') {
      await enviarTwilio(destino, codigo);
    } else {
      await enviarMeta(destino, codigo);
    }
    return { enviado: true, modo: config.whatsapp.provider.toUpperCase() };
  } catch (e) {
    console.error('[SIGELAB] Error enviando WhatsApp:', e.message);
    if (config.authDemoCodes) {
      console.log('[SIGELAB][DEMO][WHATSAPP] Código para ' + destino + ': ' + codigo);
      return { enviado: false, modo: 'DEMO_FALLBACK', error: e.message };
    }
    throw e;
  }
}

module.exports = { estaConfigurado, enviarCodigo };
