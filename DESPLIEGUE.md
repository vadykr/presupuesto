# Despliegue del servidor «Presupuesto»

Cómo poner el servidor (sync-server + cliente web en castellano) en una VM Linux
propia con HTTPS, usando la imagen que GitHub construye sola en cada push a `master`.

## 1. La imagen

- Se construye en `.github/workflows/docker.yml` y se publica en GitHub Container Registry:
  - `ghcr.io/vadykr/presupuesto:latest` — último `master`.
  - `ghcr.io/vadykr/presupuesto:sha-abc1234` — un commit concreto (útil para volver atrás).
- Arquitecturas: `linux/amd64` y `linux/arm64` (sirve para una VM Ampere de Oracle Cloud).
- También se puede lanzar a mano desde GitHub → Actions → «Imagen Docker» → _Run workflow_.

Primera vez, en GitHub:

1. **Actions** del repositorio: en un fork vienen desactivadas; pulsa «I understand my
   workflows, go ahead and enable them».
2. Settings → Actions → General → _Workflow permissions_: «Read and write permissions»
   (el workflow necesita `packages: write` para subir la imagen).
3. Tras la primera publicación, en tu perfil → Packages → `presupuesto` → Package settings:
   comprueba la visibilidad. Si el paquete queda **privado**, en la VM tendrás que hacer
   `docker login ghcr.io` con un _personal access token_ (ámbito `read:packages`); si lo
   haces **público**, `docker pull` funciona sin credenciales (el código ya es público).

## 2. La VM

Cualquier Linux con Docker sirve (Oracle Cloud _Always Free_ Ampere, Hetzner, una Raspberry
Pi en casa…). Lo que hace falta:

- Docker y Docker Compose: `curl -fsSL https://get.docker.com | sh`.
- Puertos **80** y **443** abiertos hacia la VM (en Oracle Cloud: _Security List_ de la
  subred **y** el firewall de la propia máquina, p. ej. `sudo iptables -I INPUT -p tcp
--dport 443 -j ACCEPT` y lo mismo para el 80; en Ubuntu con `ufw allow 80,443/tcp`).
- Un nombre de dominio que apunte a la IP pública de la VM. Si no tienes dominio, un
  subdominio gratuito de [DuckDNS](https://www.duckdns.org): creas `loquesea.duckdns.org`,
  le pones la IP de la VM y listo (DuckDNS da un script `cron` para actualizarla si cambia).

## 3. Arrancar

```bash
# En la VM
git clone https://github.com/vadykr/presupuesto.git   # o copia solo la carpeta despliegue/
cd presupuesto/despliegue
cp .env.ejemplo .env
nano .env            # DOMINIO=loquesea.duckdns.org
docker compose up -d
docker compose logs -f   # Caddy pide el certificado a Let's Encrypt en unos segundos
```

Abre `https://loquesea.duckdns.org`: la app pedirá crear la **contraseña del servidor**.
Desde el móvil, «Añadir a pantalla de inicio» instala la PWA.

Qué hay dentro:

| Servicio      | Imagen                              | Función                                           |
| ------------- | ----------------------------------- | ------------------------------------------------- |
| `presupuesto` | `ghcr.io/vadykr/presupuesto:latest` | Servidor Actual (puerto 5006, solo red interna)   |
| `caddy`       | `caddy:2-alpine`                    | Proxy inverso, HTTPS automático, puertos 80 y 443 |

Los datos viven en el volumen Docker `datos` (montado en `/data`): presupuestos, contraseña
del servidor y las credenciales bancarias. Caddy guarda los certificados en sus propios
volúmenes.

## 4. Actualizar, copias y vuelta atrás

```bash
cd presupuesto/despliegue
docker compose pull && docker compose up -d       # última imagen de master
```

Copia de seguridad del volumen (hazla antes de actualizar):

```bash
docker run --rm -v presupuesto_datos:/data -v "$PWD":/copia alpine \
  tar czf /copia/presupuesto-$(date +%F).tgz -C /data .
```

Para volver a una versión anterior, cambia en `docker-compose.yml` la etiqueta `:latest` por
el `:sha-…` del commit que funcionaba (está en la pestaña Packages o en los _runs_ de
Actions) y `docker compose up -d`.

## 5. Enable Banking (CaixaBank, Trade Republic)

Las claves de Enable Banking (_application ID_ y clave privada) **se introducen desde la
propia app** una vez desplegada (Cuentas → enlazar cuenta → Enable Banking). El servidor las
guarda cifradas en `/data` (base de datos del servidor). Por tanto:

- **Nunca** van al repositorio, ni en `docker-compose.yml`, ni en `.env`, ni en el código.
- Solo existen en el servidor; una copia de seguridad del volumen `datos` las incluye, así
  que guarda esas copias con el mismo cuidado.
- En el panel de Enable Banking debes registrar como _redirect URL_ la del servidor:
  `https://loquesea.duckdns.org/enablebanking/auth_callback` (la app la muestra al enlazar).
  Enable Banking exige HTTPS, de ahí el proxy Caddy.

## 6. Otros alojamientos

La misma imagen sirve en cualquier sitio que ejecute contenedores con un volumen persistente
en `/data` y exponga el puerto 5006:

- **Fly.io**: `fly launch --image ghcr.io/vadykr/presupuesto:latest`, un volumen montado en
  `/data` y `internal_port = 5006`; Fly ya pone el HTTPS. Guía general de upstream:
  `packages/docs/docs/install/fly.md`.
- **Railway / Render**: servicio desde imagen `ghcr.io/vadykr/presupuesto:latest`, volumen en
  `/data`, puerto 5006.

Variables de entorno disponibles (`ACTUAL_PORT`, `ACTUAL_LOGIN_METHOD`, límites de subida…):
`packages/docs/docs/config/index.md`.
