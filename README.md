# SIGELAB-INCOS

**Sistema de laboratorios, ambientes e inventario de equipos** del ecosistema INCOS-BENI.

Demo académico conforme al **Contrato de Conformidad v1.1.0** (núcleo SIA-INCOS en Railway). El SIGELAB no administra personas ni contraseñas: consume la identidad del SIA y guarda únicamente `persona_id`.

---

## 1. Qué hace

- Registra **ambientes** (laboratorios, datacenter, taller) con un responsable del SIA.
- Registra **equipos** con código de activo único, tipo, marca, modelo y características.
- Mantiene el **inventario** con filtros por ambiente, estado, tipo y texto.
- Permite **cambiar el estado** de un equipo (OPERATIVO / EN_MANTENIMIENTO).
- Aplica **baja lógica** (`DE_BAJA`), conservando el historial y sin reutilizar el código.
- Guarda **historial de estados** (una fila por cambio, con `persona_id`).
- Guarda **auditoría** de altas, ediciones y bajas.
- Muestra un **dashboard** con tarjetas por ambiente y resumen por estado.

---

## 2. Requisitos

- **Node.js 18 o superior** (probado con Node 24).
- Conexión a internet solo si se usa el SIA real. Con el simulador local no hace falta.

---

## 3. Arranque rápido (un solo comando)

```bash
npm install
npm start
```

Abrir: <http://127.0.0.1:4100>

`npm start` levanta automáticamente:
- el **núcleo SIA simulado** en el puerto 3000, y
- la **aplicación SIGELAB** en el puerto 4100.

El archivo `.env` está versionado **sin secretos**:

```env
API_ACADEMICO_URL=http://127.0.0.1:3000
PORT=4100
DB_BACKEND=auto
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_PROJECT_ID=incos-sigelab-2026
```

**Almacenamiento automático:**
- Si existe `serviceAccountKey.json` → usa **Firebase Firestore**.
- Si no existe → usa el archivo local `data/store.json` y el demo funciona igual.

**Base de datos en Firebase (ya creada):**
- Proyecto: `incos-sigelab-2026`
- Firestore: base `(default)`, región `southamerica-east1` (São Paulo)
- Consola: <https://console.firebase.google.com/project/incos-sigelab-2026/firestore/databases/-default-/data>

> Para usar Firestore en otra máquina, descarga el service account desde
> Firebase Console → Configuración → Cuentas de servicio y guárdalo como
> `serviceAccountKey.json` en la raíz. Sin ese archivo, el sistema usa el
> almacenamiento local automáticamente.

### Conectar con el SIA real

Editar `.env` y reiniciar:

```env
API_ACADEMICO_URL=https://sia-incos-demo.up.railway.app
PORT=4100
```

No se cambia ninguna línea de código (regla del contrato).

> **Nota:** al momento de crear este proyecto, la URL pública de Railway respondía
> `404 Application not found` (despliegue eliminado o expirado). Por eso se incluye el
> simulador local. Cuando el núcleo real vuelva a estar en línea, basta cambiar la variable.

---

## 4. Cuentas de demostración

Contraseña única: **`Demo2026*`**

| Cédula | Nombre | Rol | Cargo | Acceso en SIGELAB |
|---|---|---|---|---|
| 9000006 | Luis Fernando Añez Rivero | ADMINISTRATIVO | Encargado de Laboratorios | Todo |
| 9000007 | Patricia Gutiérrez Nazareno | SERVICIO | Técnico de Laboratorio | Consultar y cambiar estado |
| 9000001 | Ana María Rojas Vaca | ADMINISTRATIVO | Rector | Solo lectura |
| 9000002 | Carlos Eduardo Méndez Suárez | ADMINISTRATIVO | Académico | Solo lectura |
| 9000005 | Juan Pablo Quiroga Salas | Sin acceso | — | 403 (prueba) |
| 9000003 | María Elena Chávez Ortiz | ADMINISTRATIVO | Administrativo | 403 (no tiene SIGELAB) |

Las cuentas son ficticias (Anexo B del contrato).

---

## 5. Reglas de permisos

Los permisos salen del **claim `roles`** y de los **cargos** del token, nunca de una tabla local.

| Rol `roles.SIGELAB` | Cargo | Permisos |
|---|---|---|
| `ADMINISTRATIVO` | Encargado de Laboratorios | Registrar/editar equipos, gestionar ambientes, dar de baja, cambiar estado, auditoría |
| `SERVICIO` | Técnico de Laboratorio | Consultar inventario y cambiar estado (no dar de baja ni crear/editar) |
| `ADMINISTRATIVO` | Otro (Rector, Académico) | Solo lectura |
| Sin `SIGELAB` | — | 403 al ingresar |

---

## 6. Reglas de negocio

- **Código de activo único:** si ya existe, la API responde `400 REGISTRO_DUPLICADO`.
- **Baja lógica:** el estado oficial es `DE_BAJA`; se conserva el historial y el código no se reutiliza.
- **Ambiente con equipos:** no se puede dar de baja (`409 CONFLICTO`). No hay borrado en cascada.
- **Cambio de estado:** inserta una fila en `sigelab_historial_estados` con el `persona_id` que lo hizo.
- **Ambiente en formulario:** se elige de una lista desplegable, no se escribe el ID.
- **Límite de 20 equipos por sala:** es **informativo**; la API devuelve una advertencia al superarlo.

---

## 7. Endpoints del SIGELAB

Todas las respuestas usan el sobre único del ecosistema:

```json
{ "exito": true, "datos": {}, "meta": null, "error": null }
```

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login contra el SIA y validación local del JWT |
| GET | `/api/auth/me` | Datos y permisos del token actual |
| GET | `/api/auth/config` | Configuración pública (URL del SIA) |
| GET | `/api/dashboard` | Resumen por estado y por ambiente |
| GET | `/api/ambientes` | Ambientes con contador de equipos |
| POST | `/api/ambientes` | Crear ambiente (Encargado) |
| PUT | `/api/ambientes/:id` | Editar ambiente (Encargado) |
| DELETE | `/api/ambientes/:id` | Baja de ambiente sin equipos (Encargado) |
| GET | `/api/equipos` | Inventario con filtros |
| GET | `/api/equipos/catalogos` | Estados y tipos para formularios |
| GET | `/api/equipos/:id` | Detalle de equipo |
| POST | `/api/equipos` | Registrar equipo (Encargado) |
| PUT | `/api/equipos/:id` | Editar equipo (Encargado) |
| POST | `/api/equipos/:id/estado` | Cambiar estado (Encargado o Técnico) |
| DELETE | `/api/equipos/:id` | Baja lógica (solo Encargado) |
| GET | `/api/equipos/:id/historial` | Historial del equipo |
| GET | `/api/auditoria` | Auditoría (solo Encargado) |
| GET | `/api/personas` | Proxy autenticado al SIA (con respaldo en caché) |
| GET | `/api/personas/:id/cargos` | Cargos de una persona |
| GET | `/salud-integracion` | **Obligatorio del contrato** (público) |
| GET | `/health` | Chequeo simple del demo |
| GET | `/api/estado` | Diagnóstico del demo |

### Endpoints del SIA que consume

- `POST /api/v1/auth/ingresar`
- `GET /api/v1/auth/clave-publica` y `GET /.well-known/jwks.json`
- `GET /api/v1/personas`
- `GET /api/v1/personas/:id/cargos`

---

## 8. Seguridad e integración

- El login **nunca valida contraseñas localmente**: las envía al SIA.
- El JWT se valida **en el servidor** con la clave pública (`RS256`, emisor `sia-incos`, expiración).
- La clave pública se cachea **10 minutos**.
- Si el SIA no responde:
  - el demo sigue en línea y en **modo lectura** con lo ya guardado;
  - `/salud-integracion` reporta `siaEstado: "SIN_CONEXION"`;
  - se reconecta solo cuando el núcleo vuelve.
- Solo se guarda `persona_id`. Los nombres son **caché de lectura** y nunca deciden permisos.
- No se accede a MySQL ni se abren puertos del núcleo.

---

## 9. Base de datos en Firebase

La base de datos propia está **creada y operativa en Firebase Firestore**:

| Dato | Valor |
|---|---|
| Proyecto | `incos-sigelab-2026` |
| Base de datos | `(default)` |
| Región | `southamerica-east1` (São Paulo) |
| Consola | <https://console.firebase.google.com/project/incos-sigelab-2026/firestore/databases/-default-/data> |
| Credencial | `serviceAccountKey.json` (cuenta `sigelab-backend@incos-sigelab-2026.iam.gserviceaccount.com`) |

### Configuración aplicada

- `firebase.json` y `.firebaserc` apuntan al proyecto.
- `firestore.rules` **bloquea todo acceso directo desde el navegador**: solo el backend (Admin SDK) lee y escribe.
- `firestore.indexes.json` define índices para equipos e historial.
- Reglas e índices desplegados con:
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes --project incos-sigelab-2026
  ```

### Backends disponibles

| `DB_BACKEND` | Comportamiento |
|---|---|
| `firestore` (por defecto) | Firebase Firestore en la nube |
| `file` | Archivo `data/store.json` (sin internet) |
| `auto` | Firestore si hay credenciales; si no, archivo JSON |

### Colecciones (prefijo `sigelab_`)

- `sigelab_ambientes`
- `sigelab_equipos`
- `sigelab_historial_estados`
- `sigelab_auditoria`
- `sigelab_cache_personas`
- `sigelab_contadores` (IDs numéricos)

El **borrado nunca es en cascada**: la baja de equipos es lógica (`estado = DE_BAJA`).

### Volver a sembrar los datos

```bash
npm run seed
```

### Usar otro proyecto o el emulador

```env
# Otro proyecto Firebase
GOOGLE_APPLICATION_CREDENTIALS=./otra-clave.json
FIREBASE_PROJECT_ID=otro-proyecto

# Emulador local (sin credenciales)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=demo-sigelab
DB_BACKEND=firestore
```

> `serviceAccountKey.json` está en `.gitignore`: nunca se sube al repositorio.
> Si se pierde, se regenera en Firebase Console → Configuración → Cuentas de servicio.

---

## 10. Verificación de conformidad

Con el demo en ejecución:

```bash
npm run verify
```

El script `scripts/verificar-demo.js` prueba, entre otras cosas:

- `/salud-integracion` con el contrato del Anexo A;
- login contra el SIA y validación del token;
- 403 para cuentas sin acceso o sin rol SIGELAB;
- código de activo duplicado → 400;
- Técnico intentando dar de baja → 403;
- Técnico cambiando estado → 200 + fila de historial;
- borrar un ambiente con equipos → 409;
- baja lógica y conservación del historial.

Resultado esperado: **48 pruebas aprobadas, 0 fallidas**.

---

## 11. Checklist del contrato

- [x] Arranca con `npm install` y `npm start`.
- [x] Lee `API_ACADEMICO_URL` y `PORT` del entorno.
- [x] Login contra `POST /api/v1/auth/ingresar` (sin validar contraseñas localmente).
- [x] Valida la firma RS256 con la clave pública del núcleo.
- [x] Rechaza con 403 si el claim `roles` no contiene `SIGELAB`.
- [x] Guarda solo `persona_id`; los nombres son caché.
- [x] Expone `GET /salud-integracion` con el contrato del Anexo A.
- [x] Modo lectura y aviso si el núcleo se cae; reconexión automática.
- [x] HTTPS al dominio publicado, sin IPs fijas.
- [x] No incluye cadenas de conexión a MySQL ni accede a la base del núcleo.
- [x] Incluye `scripts/verificar-demo.js` con pruebas aprobadas.
- [x] `README.md` con puerto, variables, cuentas y arranque.
- [x] `.env.example` versionado, sin secretos reales.

---

## 12. Estructura del proyecto

```
incos-sigelab-web/
├── public/                 Frontend (mismo origen, sin CORS)
│   ├── login.html
│   ├── index.html          Dashboard
│   ├── inventario.html
│   ├── equipos.html        Alta / edición
│   ├── ambientes.html
│   ├── historial.html
│   ├── css/app.css
│   └── js/api.js, ui.js
├── src/
│   ├── server.js           Express
│   ├── config.js
│   ├── sia/client.js       Login, clave pública, validación JWT
│   ├── middleware/auth.js  Autenticación y permisos
│   ├── routes/             auth, ambientes, equipos, personas, dashboard, auditoría, salud
│   ├── services/           permisos, nombres
│   ├── db/                 fileStore, firestore, seed
│   └── utils/              respuesta, async, fecha
├── mock-sia/server.js      Núcleo SIA simulado (contrato v1)
├── scripts/verificar-demo.js
├── firebase.json           Configuración de Firebase CLI
├── .firebaserc             Proyecto incos-sigelab-2026
├── firestore.rules         Reglas (acceso solo desde el backend)
├── firestore.indexes.json  Índices de Firestore
├── serviceAccountKey.json  Credencial del backend (no se versiona)
├── data/store.json         Solo si DB_BACKEND=file
├── .env.example
└── README.md
```

---

## 13. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `SIN_CONEXION` al ingresar | El simulador o el SIA real no está en línea | Ejecutar `npm run mock-sia` o revisar `API_ACADEMICO_URL` |
| `403 SIN_PERMISO` | La cuenta no tiene `SIGELAB` en `roles` | Usar 9000006, 9000007, 9000001 o 9000002 |
| `401 TOKEN_INVALIDO` | Token vencido o clave distinta | Volver a ingresar |
| `404 RUTA_NO_ENCONTRADA` | Ruta con tilde | Usar `/api/v1/auth/clave-publica` sin tilde |
| El SIA real no resuelve | Dominio de Railway eliminado | Usar el simulador y reportarlo al equipo del SIA |
| `EADDRINUSE` | Puerto ocupado | Cambiar `PORT` o cerrar el proceso anterior |

---

**Equipo SIGELAB-INCOS · Ecosistema INCOS-BENI · 2026**
