const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { userDB, gameDB } = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Almacenamiento de partidas en memoria
const games = new Map();

// Middleware - Orden importante
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar sesiones ANTES de las rutas
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './' }),
  secret: 'impostor-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    httpOnly: true,
    secure: false // Cambiar a true en producción con HTTPS
  }
}));

// Log de peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Servir archivos estáticos
app.use(express.static('public'));

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  console.log('🔐 Verificando autenticación - Session ID:', req.sessionID);
  console.log('🔐 Usuario en sesión:', req.session?.userId);
  
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};

// Ruta principal - Landing
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Admin de partida
app.get('/admin-game/:gameId', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta para jugadores (sin requerir autenticación previa)
app.get('/game/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// ============ APIs de Autenticación ============

// Registro
app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('📝 Petición de registro recibida:', req.body);
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      console.log('❌ Faltan campos');
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (password.length < 6) {
      console.log('❌ Contraseña muy corta');
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    console.log('✅ Creando usuario...');
    const user = userDB.create(username, email, password);
    console.log('✅ Usuario creado:', user.id);
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Forzar guardar la sesión antes de responder
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error guardando sesión:', err);
        return res.status(500).json({ error: 'Error al crear sesión' });
      }
      console.log('✅ Sesión guardada correctamente');
      res.json({ success: true, user: { id: user.id, username: user.username } });
    });
  } catch (error) {
    console.error('❌ Error en signup:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Buscar por username o email
    let user = userDB.findByUsername(username);
    if (!user) {
      user = userDB.findByEmail(username);
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (!userDB.verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Forzar guardar la sesión antes de responder
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error guardando sesión:', err);
        return res.status(500).json({ error: 'Error al crear sesión' });
      }
      console.log('✅ Sesión guardada correctamente');
      res.json({ success: true, user: { id: user.id, username: user.username } });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ============ APIs de Usuario ============

// Perfil del usuario
app.get('/api/user/profile', requireAuth, (req, res) => {
  const user = userDB.findById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  res.json(user);
});

// ============ APIs de Partidas ============

// Crear partida
app.post('/api/games/create', requireAuth, (req, res) => {
  const { gameName, totalPlayers, impostorCount, isPublic } = req.body;
  
  if (!gameName || !totalPlayers || !impostorCount) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (impostorCount >= totalPlayers) {
    return res.status(400).json({ error: 'El número de impostores debe ser menor al total de jugadores' });
  }

  const gameId = uuidv4().substring(0, 8);
  
  games.set(gameId, {
    id: gameId,
    name: gameName,
    creatorId: req.session.userId,
    creatorName: req.session.username,
    totalPlayers: parseInt(totalPlayers),
    impostorCount: parseInt(impostorCount),
    players: [],
    started: false,
    isPublic: isPublic || false,
    roles: []
  });

  // Guardar en base de datos si es pública
  if (isPublic) {
    gameDB.create(gameId, req.session.userId, gameName, totalPlayers, impostorCount);
  }

  // Notificar actualización de partidas
  io.emit('games-updated');

  res.json({ 
    gameId, 
    link: `${req.protocol}://${req.get('host')}/game/${gameId}` 
  });
});

// Obtener partidas públicas
app.get('/api/games/public', (req, res) => {
  const publicGames = gameDB.getAvailable();
  
  // Actualizar con datos en memoria
  const gamesWithPlayers = publicGames.map(dbGame => {
    const memoryGame = games.get(dbGame.id);
    return {
      ...dbGame,
      current_players: memoryGame ? memoryGame.players.length : 0
    };
  });
  
  res.json(gamesWithPlayers);
});

// API para crear nueva partida (legacy - mantener para compatibilidad)
app.post('/api/create-game', (req, res) => {
  const { totalPlayers, impostorCount, isPrivate } = req.body;
  
  if (!totalPlayers || !impostorCount) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (impostorCount >= totalPlayers) {
    return res.status(400).json({ error: 'El número de impostores debe ser menor al total de jugadores' });
  }

  const gameId = uuidv4().substring(0, 8);
  const gameCode = isPrivate ? Math.floor(1000 + Math.random() * 9000).toString() : null;
  
  games.set(gameId, {
    id: gameId,
    totalPlayers: parseInt(totalPlayers),
    impostorCount: parseInt(impostorCount),
    players: [],
    started: false,
    roles: [],
    isPrivate: !!isPrivate,
    gameCode: gameCode
  });

  const response = { 
    gameId, 
    link: `${req.protocol}://${req.get('host')}/game/${gameId}` 
  };
  
  if (gameCode) {
    response.gameCode = gameCode;
  }
  
  res.json(response);
});

// API para obtener info de la partida
app.get('/api/game/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  
  if (!game) {
    return res.status(404).json({ error: 'Partida no encontrada' });
  }

  res.json({
    id: game.id,
    totalPlayers: game.totalPlayers,
    currentPlayers: game.players.length,
    started: game.started,
    isPrivate: game.isPrivate || false
  });
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Admin se une a una partida para monitorear
  socket.on('join-as-admin', ({ gameId }) => {
    const game = games.get(gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Partida no encontrada' });
      return;
    }

    socket.join(gameId);
    console.log(`Admin se unió a monitorear partida ${gameId}`);
    
    // Enviar estado actual
    socket.emit('player-joined', {
      players: game.players.map(p => ({ name: p.name })),
      currentCount: game.players.length,
      totalCount: game.totalPlayers
    });
  });

  // Unirse a una partida
  socket.on('join-game', ({ gameId, playerName, gameCode }) => {
    console.log(`🎮 Intento de unión - GameID: ${gameId}, Player: ${playerName}, Code: ${gameCode}`);
    const game = games.get(gameId);

    if (!game) {
      console.log('❌ Partida no encontrada');
      socket.emit('error', { message: 'Partida no encontrada' });
      return;
    }
    
    console.log(`📊 Estado de la partida: ${game.players.length}/${game.totalPlayers} jugadores`);
    
    // Verificar código si la partida es privada
    if (game.isPrivate && game.gameCode) {
      if (!gameCode || gameCode !== game.gameCode) {
        console.log('❌ Código incorrecto');
        socket.emit('error', { message: 'Código incorrecto' });
        return;
      }
      console.log('✅ Código correcto');
    }

    if (game.started) {
      socket.emit('error', { message: 'La partida ya ha comenzado' });
      return;
    }

    if (game.players.length >= game.totalPlayers) {
      socket.emit('error', { message: 'La partida está llena' });
      return;
    }

    // Verificar si el nombre ya existe
    if (game.players.some(p => p.name === playerName)) {
      socket.emit('error', { message: 'Ese nombre ya está en uso' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      role: null
    };

    game.players.push(player);
    socket.join(gameId);
    
    console.log(`✅ ${playerName} agregado. Total jugadores: ${game.players.length}`);

    // Actualizar contador en base de datos si es pública
    if (game.isPublic) {
      gameDB.updatePlayerCount(gameId, game.players.length);
      io.emit('games-updated');
    }

    // Notificar a todos los jugadores
    const eventData = {
      players: game.players.map(p => ({ name: p.name })),
      currentCount: game.players.length,
      totalCount: game.totalPlayers
    };
    
    console.log(`📡 Emitiendo player-joined a sala ${gameId}:`, eventData);
    io.to(gameId).emit('player-joined', eventData);

    socket.emit('joined-successfully', { gameId });

    console.log(`${playerName} se unió a la partida ${gameId}`);
  });

  // Iniciar partida (solo admin)
  socket.on('start-game', ({ gameId }) => {
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida no encontrada' });
      return;
    }

    if (game.players.length < 3) {
      socket.emit('error', { message: 'Se necesitan al menos 3 jugadores para iniciar' });
      return;
    }

    if (game.started) {
      socket.emit('error', { message: 'La partida ya ha comenzado' });
      return;
    }

    // Asignar roles aleatoriamente
    const playerIndices = Array.from({ length: game.players.length }, (_, i) => i);
    const shuffled = playerIndices.sort(() => Math.random() - 0.5);
    
    // Los primeros N son impostores
    const impostorIndices = shuffled.slice(0, game.impostorCount);

    game.players.forEach((player, index) => {
      player.role = impostorIndices.includes(index) ? 'impostor' : 'inocente';
    });

    game.started = true;

    // Actualizar estado en base de datos
    if (game.isPublic) {
      gameDB.updateStatus(gameId, 'playing');
      io.emit('games-updated');
    }

    // Enviar rol a cada jugador
    game.players.forEach(player => {
      io.to(player.id).emit('game-started', {
        role: player.role
      });
    });

    console.log(`Partida ${gameId} iniciada con ${game.impostorCount} impostor(es)`);
  });

  // Reiniciar partida
  socket.on('reset-game', ({ gameId }) => {
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Partida no encontrada' });
      return;
    }

    game.started = false;
    game.players.forEach(player => {
      player.role = null;
    });

    io.to(gameId).emit('game-reset');
    console.log(`Partida ${gameId} reiniciada`);
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);

    // Buscar y remover al jugador de su partida
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        game.players.splice(playerIndex, 1);

        // Actualizar base de datos si es pública
        if (game.isPublic) {
          gameDB.updatePlayerCount(gameId, game.players.length);
          io.emit('games-updated');
        }

        io.to(gameId).emit('player-left', {
          playerName: player.name,
          players: game.players.map(p => ({ name: p.name })),
          currentCount: game.players.length,
          totalCount: game.totalPlayers
        });

        // Si no quedan jugadores, eliminar la partida después de 1 hora
        if (game.players.length === 0) {
          setTimeout(() => {
            if (games.has(gameId) && games.get(gameId).players.length === 0) {
              games.delete(gameId);
              if (game.isPublic) {
                gameDB.delete(gameId);
                io.emit('games-updated');
              }
              console.log(`Partida ${gameId} eliminada por inactividad`);
            }
          }, 3600000); // 1 hora
        }
      }
    });
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Servidor del juego del impostor corriendo en puerto ${PORT}`);
  console.log(`🌐 Accede en: http://localhost:${PORT}`);
  console.log(`📡 Listo para recibir conexiones...`);
});
