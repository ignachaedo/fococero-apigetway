# API Gateway — FocoCero

> Punto de entrada único (BFF) para la plataforma de reporte y coordinación de incendios forestales FocoCero. Enruta, asegura y observa todo el tráfico hacia los microservicios del backend.

[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4.22-blue)](https://expressjs.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express v4 |
| **Proxy** | `http-proxy-middleware` v3 |
| **Autenticación** | Firebase Admin SDK (`firebase-admin` v13) |
| **Rate Limiting** | `express-rate-limit` (global por IP) + Redis (por UID) |
| **Cache / Limitador** | Redis 7 |
| **Documentación** | Swagger (`swagger-jsdoc` + `swagger-ui-express`) |
| **Métricas** | Prometheus (`prom-client`) |
| **Service Discovery** | Eureka Client (`eureka-js-client`) |
| **Seguridad** | Helmet, CORS, Compression, Morgan |
| **Validación** | Zod v4 |
| **Logging** | Pino |

---

## Requisitos previos

- **Node.js** v20.0.0 o superior
- **npm** v9+
- **Docker** (para ejecutar Redis y otros servicios de infraestructura local)

---

## Variables de entorno

| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `PORT` | `number` | `3000` | Puerto donde escucha el Gateway |
| `NODE_ENV` | `enum` | `development` | Entorno de ejecución (`development`, `production`, `test`) |
| `AUTH_SERVICE_URL` | `string` | `http://localhost:3001` | URL del microservicio de autenticación |
| `GEO_SERVICE_URL` | `string` | `http://localhost:3002` | URL del microservicio geoespacial |
| `ALERTAS_SERVICE_URL` | `string` | `http://localhost:3003` | URL del microservicio de alertas |
| `REPORTES_SERVICE_URL` | `string` | `http://localhost:3004` | URL del microservicio de reportes |
| `MULTIMEDIA_SERVICE_URL` | `string` | `http://localhost:3005` | URL del microservicio de multimedia |
| `EMERGENCIAS_SERVICE_URL` | `string` | `http://localhost:3006` | URL del microservicio de emergencias |
| `ANALITICA_SERVICE_URL` | `string` | `http://localhost:3007` | URL del microservicio de analítica |
| `EUREKA_HOST` | `string` | `localhost` | Host del servidor Eureka para service discovery |
| `INTERNAL_SECRET_TOKEN` | `string` | — | Token compartido para comunicación zero-trust entre gateway y microservicios |
| `REDIS_URL` | `string` | `redis://redis-fococero:6379` | URL de conexión a Redis para rate limiting |
| `CORS_ORIGINS` | `string` | `http://localhost:5173,http://localhost:3000` | Lista blanca de orígenes CORS separados por coma |
| `FIREBASE_PROJECT_ID` | `string` | — | ID del proyecto Firebase |
| `FIREBASE_CLIENT_EMAIL` | `string` | — | Email de la cuenta de servicio de Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | `string` | — | Llave privada de la cuenta de servicio (con `\n` escapados) |

> **Nota**: `FIREBASE_PRIVATE_KEY` se transforma automáticamente: los `\n` literales se convierten en saltos de línea reales y se eliminan comillas circundantes.

---

## Instalación y ejecución

```bash
# 1. Clonar el repositorio e instalar dependencias
cd fococero-backend/api-gateway
npm install

# 2. Iniciar Redis (necesario para rate limiting por UID)
docker run -d --name redis-fococero -p 6379:6379 redis:7-alpine

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correspondientes

# 4. Iniciar en modo desarrollo
npm run dev

# 5. (Alternativa) Build y producción
npm run build
npm start
```

El Gateway se iniciará en `http://localhost:3000` con recarga automática en modo desarrollo (`ts-node-dev`).

---

## Endpoints

### Healthcheck

```
GET /health
```

```json
{
  "status": "OK",
  "service": "FocoCero-Gateway",
  "timestamp": "2026-06-21T12:00:00.000Z"
}
```

### Rutas proxy

| Ruta | Microservicio destino | Auth | Descripción |
|------|----------------------|------|-------------|
| `/api/auth/*` | `ms-auth` (puerto 3001) | Público | Login, registro, Google Sign-In, perfil |
| `/api/geo/*` | `ms-geo` (puerto 3002) | 🔒 Token | Datos geoespaciales, mapas, zonas de riesgo |
| `/api/alertas/*` | `ms-alertas` (puerto 3003) | 🔒 Token | Gestión de alertas y notificaciones |
| `/api/reportes/*` | `ms-reportes` (puerto 3004) | 🔒 Token | Creación y consulta de reportes de incendio |
| `/api/multimedia/*` | `ms-multimedia` (puerto 3005) | 🔒 Token | Subida y gestión de imágenes/videos |
| `/api/emergencias/*` | `ms-emergencias` (puerto 3006) | 🔒 Token | Despacho y coordinación de emergencias |
| `/api/analitica/*` | `ms-analitica` (puerto 3007) | 🔒 Token | Capa de inteligencia y análisis de riesgo |

### Métricas Prometheus

```
GET /metrics
```

Expone métricas de rendimiento recolectadas con `prom-client` (tiempos de respuesta, conteo de peticiones, etc.).

---

## Swagger

La documentación interactiva de la API está disponible en:

```
http://localhost:3000/api/docs
```

Se genera con `swagger-jsdoc` a partir de los comentarios JSDoc en las rutas y se sirve con `swagger-ui-express`.

---

## Seguridad

### Firewall perimetral

- **Helmet**: Cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options, etc.).
- **CORS**: Lista blanca configurable vía `CORS_ORIGINS`. Bloquea orígenes no autorizados.
- **Compression**: Respuestas comprimidas con gzip para rendimiento.

### Autenticación con Firebase

El middleware `verifyToken` valida tokens ID de Firebase (`verifyIdToken` con `checkRevoked: true`) en todas las rutas protegidas. Inyecta los headers `x-user-id`, `x-user-email` y `x-user-role` para que los microservicios downstream no necesiten re-validar el token.

**Rutas con bypass automático** (no requieren token):

- `POST /api/auth/login`
- `POST /api/auth/register-guest`
- `POST /api/auth/register-full`
- `POST /api/auth/google`
- `GET /api/alertas/publicas`

### Rate Limiting

Dos capas de limitación:

| Capa | Mecanismo | Ventana | Límite | Alcance |
|------|-----------|---------|--------|---------|
| **Global** | `express-rate-limit` (en memoria) | 15 min | 100 req | Por IP |
| **Por UID** | Redis (`INCR` + `EXPIRE`) | 15 min | 200 req | Por `x-user-id` o IP (fallback) |

El limitador por UID degrada gracefulmente si Redis no está disponible.

### Zero-Trust interno

El Gateway inyecta automáticamente el header `x-internal-token` en cada petición proxy. Los microservicios deben validar este token para asegurar que la petición proviene exclusivamente del Gateway y no de un cliente directo.

### Anti-spoofing

El middleware `verifyToken` elimina cualquier header `x-user-id`, `x-user-email` o `x-user-role` entrante antes de inyectar los valores validados, previniendo suplantación.

---

## Eureka (Service Discovery)

Al iniciar, el Gateway se registra en el servidor Eureka (`eureka-server:8761`) con el nombre `API-GATEWAY`. Esto permite que otros servicios y balanceadores descubran el Gateway dinámicamente.

```typescript
initEurekaClient("api-gateway", envs.PORT);
```

En desarrollo local (cuando `EUREKA_HOST=localhost`), el registro usa `localhost` como hostname. En Docker, usa el nombre del servicio.

---

## Arquitectura

```
                    ┌──────────────┐
                    │   Cliente    │
                    │ (App Móvil)  │
                    └──────┬───────┘
                           │ HTTPS
                           ▼
                    ┌──────────────┐
                    │    Caddy     │
                    │ (Reverse    │
                    │  Proxy)     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  API GATEWAY │  ← Estás aquí
                    │  (Express)   │
                    │  :3000       │
                    └──┬──┬──┬──┬──┘
                       │  │  │  │
         ┌─────────────┘  │  │  └──────────────┐
         ▼                ▼  ▼                 ▼
    ┌──────────┐   ┌──────────┐   ┌──────────────┐
    │  ms-auth │   │  ms-geo  │   │  ms-analitica │  ...
    │  :3001   │   │  :3002   │   │  :3007        │
    └──────────┘   └──────────┘   └──────────────┘
         │               │               │
         ▼               ▼               ▼
    ┌────────────────────────────────────────────┐
    │            PostgreSQL + PostGIS            │
    │            Redis · RabbitMQ                │
    └────────────────────────────────────────────┘
```

El Gateway funciona como **único punto de entrada** (BFF — Backend For Frontend). No expone `express.json()` para no consumir el body de las peticiones antes de proxyarlas. Cada ruta `/api/<servicio>` se traduce a una URL interna del microservicio correspondiente mediante `http-proxy-middleware`, propagando headers de trazabilidad (`x-trace-id`, `x-correlation-id`) y el token interno de seguridad.

---

## Desarrollo

```bash
# Verificar que el gateway responde
curl http://localhost:3000/health

# Probar proxy a ms-auth
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -d '{"token": "<FIREBASE_TOKEN>"}'

# Ver logs en desarrollo
npm run dev  # consola con pino-pretty

# Ejecutar tests
npm test
```

---

## Licencia

ISC © FocoCero Team
