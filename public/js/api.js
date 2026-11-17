'use strict';

/**
 * Cliente HTTP del frontend y manejo de la sesion.
 * El token del SIA se guarda en localStorage para las peticiones autenticadas.
 */
const API = (function () {
  const K_TOKEN = 'sigelab_token';
  const K_USER = 'sigelab_usuario';
  const K_PERM = 'sigelab_permisos';

  function token() {
    return localStorage.getItem(K_TOKEN);
  }

  function usuario() {
    try {
      return JSON.parse(localStorage.getItem(K_USER) || 'null');
    } catch (e) {
      return null;
    }
  }

  function permisos() {
    try {
      return JSON.parse(localStorage.getItem(K_PERM) || 'null');
    } catch (e) {
      return null;
    }
  }

  function guardar(datos) {
    if (!datos || !datos.token) return;
    localStorage.setItem(K_TOKEN, datos.token);
    localStorage.setItem(K_USER, JSON.stringify(datos.usuario || null));
    localStorage.setItem(K_PERM, JSON.stringify(datos.permisos || null));
  }

  function limpiar() {
    localStorage.removeItem(K_TOKEN);
    localStorage.removeItem(K_USER);
    localStorage.removeItem(K_PERM);
  }

  async function pedir(ruta, opciones) {
    const o = opciones || {};
    const headers = {};
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = 'Bearer ' + token();

    let res;
    try {
      res = await fetch(ruta, {
        method: o.method || 'GET',
        headers,
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      });
    } catch (e) {
      const err = new Error('No se pudo conectar con el servidor del demo.');
      err.codigo = 'SIN_CONEXION';
      throw err;
    }

    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }

    if (res.status === 401) {
      limpiar();
      if (!/login\.html$/.test(location.pathname)) {
        location.replace('/login.html');
      }
      const err = new Error((json && json.error && json.error.mensaje) || 'Sesión expirada.');
      err.codigo = (json && json.error && json.error.codigo) || 'NO_AUTENTICADO';
      throw err;
    }

    if (!res.ok || (json && json.exito === false)) {
      const err = new Error((json && json.error && json.error.mensaje) || 'Ocurrió un error.');
      err.codigo = json && json.error && json.error.codigo;
      err.status = res.status;
      err.detalle = json;
      throw err;
    }

    return json ? json.datos : null;
  }

  async function salud() {
    const res = await fetch('/salud-integracion');
    if (!res.ok) throw new Error('Sin respuesta de /salud-integracion');
    return res.json();
  }

  return { token, usuario, permisos, guardar, limpiar, pedir, salud };
})();

function proteger() {
  if (!API.token()) {
    location.replace('/login.html');
  }
}

function salir() {
  API.limpiar();
  location.replace('/login.html');
}
