# 🎭 El Impostor - Juego Multijugador Online

Juego multijugador en tiempo real donde los jugadores deben descubrir quién es el impostor entre ellos. Incluye sistema de cuentas, ranking y búsqueda de partidas públicas.

## 🚀 Demo en Vivo

Despliega tu propia versión en minutos:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## 🚀 Instalación

1. Clona el repositorio o descarga los archivos

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor:
```bash
npm start
```

O para desarrollo con auto-reinicio:
```bash
npm run dev
```

4. Abre tu navegador en `http://localhost:3000`

## 📖 Cómo Usar

### Primera vez:

1. Accede a `http://localhost:3000`
2. Haz clic en "Registrarse"
3. Crea tu cuenta con usuario, email y contraseña
4. Serás redirigido automáticamente al dashboard

### Dashboard:

Desde el dashboard puedes:
- Ver tus estadísticas personales
- Buscar partidas públicas disponibles
- Crear tu propia partida (pública o privada)
- Unirte a partidas con código

### Crear Partida:

1. Haz clic en "➕ Crear Partida"
2. Configura:
   - Nombre de la partida
   - Número total de jugadores (3-20)
   - Número de impostores (1-5)
   - Si es pública o privada
3. Si es pública, aparecerá en la lista para que otros se unan
4. Si es privada, comparte el enlace manualmente

### Para el Administrador de la Partida:

1. Después de crear la partida, verás la sala de espera
2. Comparte el enlace con los jugadores
3. Espera a que todos se conecten
4. Haz clic en "🚀 Iniciar Partida" cuando estén listos
5. Los jugadores recibirán sus roles automáticamente

### Para los Jugadores:

1. Accede al enlace compartido (debes estar registrado)
2. Ingresa tu nombre para unirte
3. Espera a que el admin inicie la partida
4. Se te revelará tu rol (impostor o inocente)
5. ¡No muestres tu pantalla a los demás!

## 🎯 Roles

### 🔴 Impostor
- Tu objetivo es engañar a los demás sin ser descubierto
- Mantén la calma y actúa con naturalidad

### 🟢 Inocente
- Tu objetivo es descubrir quién es el impostor
- Observa cuidadosamente el comportamiento de todos

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **WebSockets**: Socket.IO para comunicación en tiempo real
- **Base de Datos**: SQLite (better-sqlite3)
- **Autenticación**: Express-session + bcryptjs
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Generación de IDs**: UUID

## 📁 Estructura del Proyecto

```
impostor-game/
├── server.js           # Servidor principal con Express y Socket.IO
├── database.js         # Gestión de base de datos SQLite
├── package.json        # Dependencias y scripts
├── public/            # Archivos estáticos
│   ├── index.html     # Landing page con login/registro
│   ├── dashboard.html # Dashboard del usuario
│   ├── admin.html     # Panel de administración de partida
│   └── player.html    # Interfaz de jugador
├── impostor.db        # Base de datos (generada automáticamente)
└── README.md          # Este archivo
```

## 💾 Base de Datos

El sistema usa SQLite con las siguientes tablas:

- **users**: Información de usuarios (username, email, password hash, estadísticas)
- **game_history**: Historial de partidas jugadas
- **active_games**: Partidas públicas activas

La base de datos se crea automáticamente al iniciar el servidor.

## 🌐 Despliegue

### Opciones de Hosting:

1. **Heroku**: 
   - Crea una cuenta en Heroku
   - Instala Heroku CLI
   - Ejecuta: `heroku create`, `git push heroku main`

2. **Railway**:
   - Conecta tu repositorio GitHub
   - Railway detectará automáticamente Node.js

3. **Render**:
   - Crea un nuevo Web Service
   - Conecta tu repositorio
   - Configura el comando de inicio: `npm start`

4. **DigitalOcean App Platform**:
   - Sube tu código
   - Configura el puerto y el comando de inicio

### Variables de Entorno:

El servidor usa el puerto 3000 por defecto, pero respeta la variable `PORT` para servicios en la nube:

```bash
PORT=3000 npm start
```

## 🔧 Configuración Avanzada

### Cambiar el Puerto:

Edita `server.js` línea 12:
```javascript
const PORT = process.env.PORT || 3000;
```

### Ajustar Límites:

En `server.js` puedes modificar:
- Máximo de jugadores por partida
- Tiempo de limpieza de partidas inactivas
- Número máximo de impostores

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Siéntete libre de:
- Reportar bugs
- Sugerir nuevas características
- Enviar pull requests

## 📝 Licencia

ISC

## 🎉 Disfruta del Juego

¡Buena suerte descubriendo (o siendo) el impostor!
