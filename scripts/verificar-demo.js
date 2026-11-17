'use strict';

/**
 * Verificador del demo SIGELAB-INCOS.
 *
 * Ejecuta las pruebas de conformidad del Contrato de Conformidad v1.1.0
 * y las pruebas de negocio de la guia del SIGELAB.
 *
 * Uso:
 *   node scripts/verificar-demo.js
 *   DEMO_URL=http://127.0.0.1:4100 node scripts/verificar-demo.js
 */

const BASE = (process.env.DEMO_URL || 'http://127.0.0.1:' + (process.env.PORT || 4100)).replace(/\/+$/, '');

let aprobadas = 0;
let fallidas = 0;
const detalleFallos = [];

function check(nombre, condicion, detalle) {
  if (condicion) {
    aprobadas += 1;
    console.log('  [OK]    ' + nombre);
  } else {
    fallidas += 1;
    detalleFallos.push(nombre + (detalle ? ' -> ' + detalle : ''));
    console.log('  [FALLA] ' + nombre + (detalle ? ' -> ' + detalle : ''));
  }
}

async function req(ruta, opciones) {
  const o = opciones || {};
  const headers = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  const res = await fetch(BASE + ruta, {
    method: o.method || 'GET',
    headers,
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }
  return { status: res.status, json };
}

async function login(identificador) {
  return req('/api/auth/login', {
    method: 'POST',
    body: { identificador, clave: 'Demo2026*' },
  });
}

async function main() {
  console.log('====================================================');
  console.log('  Verificación SIGELAB-INCOS');
  console.log('  Demo: ' + BASE);
  console.log('====================================================\n');

  // ----------------------------------------------------------------
  console.log('1. Endpoints públicos de conformidad');
  // ----------------------------------------------------------------
  const salud = await req('/salud-integracion');
  check('GET /salud-integracion responde 200', salud.status === 200, 'status ' + salud.status);
  const s = salud.json || {};
  check('salud.sistema = SIGELAB', s.sistema === 'SIGELAB', JSON.stringify(s.sistema));
  check('salud.version presente', typeof s.version === 'string' && s.version.length > 0);
  check('salud.siaUrl presente', typeof s.siaUrl === 'string' && s.siaUrl.length > 0);
  check('salud.siaEstado válido', s.siaEstado === 'CONECTADO' || s.siaEstado === 'SIN_CONEXION', String(s.siaEstado));
  check('salud.jwt.emisor = sia-incos', s.jwt && s.jwt.emisor === 'sia-incos', JSON.stringify(s.jwt));
  check('salud.jwt.valida booleano', s.jwt && typeof s.jwt.valida === 'boolean');
  check('salud.jwt.claveCacheada booleano', s.jwt && typeof s.jwt.claveCacheada === 'boolean');
  check('salud.hora con offset -04:00', typeof s.hora === 'string' && /-04:00$/.test(s.hora), String(s.hora));

  const health = await req('/health');
  check('GET /health responde 200', health.status === 200, 'status ' + health.status);

  const sinToken = await req('/api/ambientes');
  check('Sin token -> 401 NO_AUTENTICADO', sinToken.status === 401 && sinToken.json?.error?.codigo === 'NO_AUTENTICADO');

  // ----------------------------------------------------------------
  console.log('\n2. Autenticación contra el núcleo');
  // ----------------------------------------------------------------
  const encargado = await login('9000006');
  check('Login Encargado (9000006) -> 200', encargado.status === 200, 'status ' + encargado.status);
  const tokenEncargado = encargado.json?.datos?.token;
  check('El login devuelve token', typeof tokenEncargado === 'string' && tokenEncargado.length > 20);
  check(
    'Encargado puede gestionar (canManage)',
    encargado.json?.datos?.permisos?.canManage === true,
    JSON.stringify(encargado.json?.datos?.permisos)
  );

  const tecnico = await login('9000007');
  check('Login Técnico (9000007) -> 200', tecnico.status === 200, 'status ' + tecnico.status);
  const tokenTecnico = tecnico.json?.datos?.token;
  check(
    'Técnico puede cambiar estado (canChangeState)',
    tecnico.json?.datos?.permisos?.canChangeState === true,
    JSON.stringify(tecnico.json?.datos?.permisos)
  );
  check(
    'Técnico NO puede gestionar (canManage=false)',
    tecnico.json?.datos?.permisos?.canManage === false
  );

  const sinAcceso = await login('9000005');
  check('Login sin acceso (9000005) -> 403 SIN_PERMISO', sinAcceso.status === 403 && sinAcceso.json?.error?.codigo === 'SIN_PERMISO', 'status ' + sinAcceso.status);

  const sinSigelab = await login('9000003');
  check('Login sin rol SIGELAB (9000003) -> 403', sinSigelab.status === 403 && sinSigelab.json?.error?.codigo === 'SIN_PERMISO', 'status ' + sinSigelab.status);

  const credencialesMalas = await req('/api/auth/login', {
    method: 'POST',
    body: { identificador: '9000006', clave: 'incorrecta' },
  });
  check('Contraseña incorrecta -> 401', credencialesMalas.status === 401, 'status ' + credencialesMalas.status);

  const me = await req('/api/auth/me', { token: tokenEncargado });
  check('GET /api/auth/me con token -> 200', me.status === 200, 'status ' + me.status);

  if (!tokenEncargado || !tokenTecnico) {
    console.log('\nNo se pudo continuar: faltan tokens válidos.');
    resumen();
    return;
  }

  // ----------------------------------------------------------------
  console.log('\n3. Dashboard y ambientes');
  // ----------------------------------------------------------------
  const dashboard = await req('/api/dashboard', { token: tokenEncargado });
  check('GET /api/dashboard -> 200', dashboard.status === 200, 'status ' + dashboard.status);
  check('Dashboard tiene resumen por estado', dashboard.json?.datos?.resumen_por_estado !== undefined);
  check('Dashboard lista ambientes', Array.isArray(dashboard.json?.datos?.ambientes) && dashboard.json.datos.ambientes.length > 0);

  const ambientes = await req('/api/ambientes', { token: tokenEncargado });
  check('GET /api/ambientes -> 200', ambientes.status === 200, 'status ' + ambientes.status);
  const listaAmbientes = ambientes.json?.datos || [];
  check('El listado de ambientes trae contador', listaAmbientes.length > 0 && listaAmbientes[0].equipos_total !== undefined);

  const ambienteConEquipos = listaAmbientes.find((a) => a.equipos_total > 0);
  const ambienteVacio = listaAmbientes.find((a) => a.equipos_total === 0);

  // ----------------------------------------------------------------
  console.log('\n4. Registro de equipos y validaciones');
  // ----------------------------------------------------------------
  const sello = Date.now();
  const codigoPrueba = 'VERIF-' + sello;

  const duplicado = await req('/api/equipos', {
    method: 'POST',
    token: tokenEncargado,
    body: {
      ambiente_id: ambienteConEquipos ? ambienteConEquipos.id : 1,
      codigo_activo: 'LAB1-PC-001',
      tipo: 'COMPUTADORA',
      marca: 'Prueba',
      modelo: 'Duplicado',
    },
  });
  check('Código de activo duplicado -> 400', duplicado.status === 400 && duplicado.json?.error?.codigo === 'REGISTRO_DUPLICADO', 'status ' + duplicado.status);

  const incompleto = await req('/api/equipos', {
    method: 'POST',
    token: tokenEncargado,
    body: { codigo_activo: 'SIN-AMBIENTE', tipo: 'PC' },
  });
  check('Equipo sin ambiente/tipo/marca/modelo -> 400', incompleto.status === 400, 'status ' + incompleto.status);

  const creado = await req('/api/equipos', {
    method: 'POST',
    token: tokenEncargado,
    body: {
      ambiente_id: ambienteConEquipos ? ambienteConEquipos.id : 1,
      codigo_activo: codigoPrueba,
      tipo: 'COMPUTADORA',
      marca: 'Equipo',
      modelo: 'De Prueba',
      caracteristicas: 'Generado por el verificador automático.',
    },
  });
  check('Crear equipo válido -> 201', creado.status === 201, 'status ' + creado.status + ' ' + JSON.stringify(creado.json?.error));
  const idPrueba = creado.json?.datos?.id;
  check('El equipo creado devuelve id', Boolean(idPrueba));

  const tecnicoCrea = await req('/api/equipos', {
    method: 'POST',
    token: tokenTecnico,
    body: {
      ambiente_id: ambienteConEquipos ? ambienteConEquipos.id : 1,
      codigo_activo: 'TEC-' + sello,
      tipo: 'COMPUTADORA',
      marca: 'Técnico',
      modelo: 'No permitido',
    },
  });
  check('Técnico intentando crear equipo -> 403', tecnicoCrea.status === 403 && tecnicoCrea.json?.error?.codigo === 'SIN_PERMISO', 'status ' + tecnicoCrea.status);

  // ----------------------------------------------------------------
  console.log('\n5. Cambio de estado e historial');
  // ----------------------------------------------------------------
  const cambioTecnico = await req('/api/equipos/' + idPrueba + '/estado', {
    method: 'POST',
    token: tokenTecnico,
    body: { estado_nuevo: 'EN_MANTENIMIENTO', observacion: 'Prueba del verificador.' },
  });
  check('Técnico cambia estado -> 200', cambioTecnico.status === 200, 'status ' + cambioTecnico.status + ' ' + JSON.stringify(cambioTecnico.json?.error));
  check('El cambio inserta fila de historial', Boolean(cambioTecnico.json?.datos?.historial?.id));

  const mismoEstado = await req('/api/equipos/' + idPrueba + '/estado', {
    method: 'POST',
    token: tokenTecnico,
    body: { estado_nuevo: 'EN_MANTENIMIENTO' },
  });
  check('Cambiar al mismo estado -> 400', mismoEstado.status === 400, 'status ' + mismoEstado.status);

  const estadoInvalido = await req('/api/equipos/' + idPrueba + '/estado', {
    method: 'POST',
    token: tokenEncargado,
    body: { estado_nuevo: 'DE_BAJA' },
  });
  check('Cambio de estado a DE_BAJA por endpoint de estado -> 400', estadoInvalido.status === 400, 'status ' + estadoInvalido.status);

  const historial = await req('/api/equipos/' + idPrueba + '/historial', { token: tokenEncargado });
  check('GET historial -> 200', historial.status === 200, 'status ' + historial.status);
  const filas = historial.json?.datos?.historial || [];
  check('El historial tiene al menos una fila', filas.length >= 1, 'filas ' + filas.length);
  check('Cada fila guarda persona_id', filas.every((h) => h.persona_id !== undefined && h.persona_id !== null));

  const bajaTecnico = await req('/api/equipos/' + idPrueba, {
    method: 'DELETE',
    token: tokenTecnico,
    body: { observacion: 'El técnico no debería poder.' },
  });
  check('Técnico intentando dar de baja -> 403', bajaTecnico.status === 403 && bajaTecnico.json?.error?.codigo === 'SIN_PERMISO', 'status ' + bajaTecnico.status);

  const bajaEncargado = await req('/api/equipos/' + idPrueba, {
    method: 'DELETE',
    token: tokenEncargado,
    body: { observacion: 'Baja de prueba del verificador.' },
  });
  check('Encargado da de baja -> 200', bajaEncargado.status === 200, 'status ' + bajaEncargado.status);
  check('La baja es lógica (estado DE_BAJA)', bajaEncargado.json?.datos?.equipo?.estado === 'DE_BAJA');

  const historialTrasBaja = await req('/api/equipos/' + idPrueba + '/historial', { token: tokenEncargado });
  const filasTrasBaja = historialTrasBaja.json?.datos?.historial || [];
  check('La baja también genera historial', filasTrasBaja.some((h) => h.estado_nuevo === 'DE_BAJA'));

  // El equipo dado de baja conserva su código: no se puede reutilizar.
  const reutilizar = await req('/api/equipos', {
    method: 'POST',
    token: tokenEncargado,
    body: {
      ambiente_id: ambienteConEquipos ? ambienteConEquipos.id : 1,
      codigo_activo: codigoPrueba,
      tipo: 'COMPUTADORA',
      marca: 'Reuso',
      modelo: 'No permitido',
    },
  });
  check('No se reutiliza el código de un equipo dado de baja -> 400', reutilizar.status === 400, 'status ' + reutilizar.status);

  // ----------------------------------------------------------------
  console.log('\n6. Ambientes sin cascada');
  // ----------------------------------------------------------------
  if (ambienteConEquipos) {
    const borrarConEquipos = await req('/api/ambientes/' + ambienteConEquipos.id, {
      method: 'DELETE',
      token: tokenEncargado,
    });
    check('Borrar ambiente con equipos -> 409 CONFLICTO', borrarConEquipos.status === 409 && borrarConEquipos.json?.error?.codigo === 'CONFLICTO', 'status ' + borrarConEquipos.status);
  }

  const nuevoAmbiente = await req('/api/ambientes', {
    method: 'POST',
    token: tokenEncargado,
    body: {
      codigo: 'VERIF-AMB-' + sello,
      nombre: 'Ambiente de verificación',
      tipo: 'OTRO',
      capacidad_maxima: 5,
    },
  });
  check('Crear ambiente válido -> 201', nuevoAmbiente.status === 201, 'status ' + nuevoAmbiente.status + ' ' + JSON.stringify(nuevoAmbiente.json?.error));
  const idAmbienteNuevo = nuevoAmbiente.json?.datos?.id;

  const borrarVacio = await req('/api/ambientes/' + idAmbienteNuevo, {
    method: 'DELETE',
    token: tokenEncargado,
  });
  check('Borrar ambiente sin equipos -> 200', borrarVacio.status === 200, 'status ' + borrarVacio.status);
  check('El ambiente queda inactivo', borrarVacio.json?.datos?.activo === false);

  // ----------------------------------------------------------------
  console.log('\n7. Modo lectura / tolerancia a fallos');
  // ----------------------------------------------------------------
  // Este chequeo no apaga el núcleo: valida que el contrato de salud sea coherente.
  check(
    'Salud reporta un estado válido del núcleo',
    s.siaEstado === 'CONECTADO' || s.siaEstado === 'SIN_CONEXION'
  );

  resumen();
}

function resumen() {
  console.log('\n====================================================');
  console.log('  Resultado: ' + aprobadas + ' aprobadas, ' + fallidas + ' fallidas');
  console.log('====================================================');
  if (fallidas > 0) {
    console.log('\nFallos:');
    for (const f of detalleFallos) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('\nTodas las pruebas pasaron.');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nError ejecutando el verificador:', e.message);
  process.exit(1);
});
