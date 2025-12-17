const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { userDB, gameDB } = require('./database');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Configurar servidor PeerJS para WebRTC
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs'
});

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

// Middleware para evitar cacheo de archivos HTML
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Servir archivos estáticos
app.use(express.static('public'));

// Montar servidor PeerJS
app.use('/peerjs', peerServer);

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

// Middleware de autenticación de Super Admin
const requireSuperAdmin = (req, res, next) => {
  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'hector@admin.com';
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
  
  if (req.session && req.session.isSuperAdmin) {
    return next();
  }
  
  res.status(403).json({ error: 'Acceso denegado. Solo Super Admin.' });
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

// Super Admin Panel
app.get('/superadmin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'superadmin.html'));
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
    const { username, email, password, avatar } = req.body;
    
    if (!username || !email || !password) {
      console.log('❌ Faltan campos');
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (password.length < 6) {
      console.log('❌ Contraseña muy corta');
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    console.log('✅ Creando usuario...');
    const user = userDB.create(username, email, password, avatar || 'avatar1');
    console.log('✅ Usuario creado:', user.id);
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.avatar = user.avatar;
    
    // Forzar guardar la sesión antes de responder
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error guardando sesión:', err);
        return res.status(500).json({ error: 'Error al crear sesión' });
      }
      console.log('✅ Sesión guardada correctamente');
      res.json({ success: true, user: { id: user.id, username: user.username, avatar: user.avatar } });
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

// ============ APIs de Super Admin ============

// Login de Super Admin
app.post('/api/superadmin/login', (req, res) => {
  const { email, password } = req.body;
  
  const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'hector@admin.com';
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
  
  if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
    req.session.isSuperAdmin = true;
    req.session.superAdminEmail = email;
    
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Error al crear sesión' });
      }
      res.json({ success: true });
    });
  } else {
    res.status(401).json({ error: 'Credenciales incorrectas' });
  }
});

// Verificar sesión de Super Admin
app.get('/api/superadmin/verify', (req, res) => {
  if (req.session && req.session.isSuperAdmin) {
    res.json({ authenticated: true, email: req.session.superAdminEmail });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout de Super Admin
app.post('/api/superadmin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Obtener todos los usuarios
app.get('/api/superadmin/users', requireSuperAdmin, (req, res) => {
  try {
    const users = userDB.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Obtener historial de un usuario
app.get('/api/superadmin/users/:userId/history', requireSuperAdmin, (req, res) => {
  try {
    const history = userDB.getUserHistory(req.params.userId);
    const user = userDB.findById(req.params.userId);
    res.json({ user, history });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Obtener estadísticas globales
app.get('/api/superadmin/stats', requireSuperAdmin, (req, res) => {
  try {
    const globalStats = userDB.getGlobalStats();
    const recentGames = gameDB.getGameHistory(50);
    const activeGames = gameDB.getAllGames();
    
    res.json({
      global: globalStats,
      recentGames,
      activeGames
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
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
  
  // Generar código si es privada
  const gameCode = !isPublic ? Math.floor(1000 + Math.random() * 9000).toString() : null;
  
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
    isPrivate: !isPublic,
    gameCode: gameCode,
    roles: []
  });

  // Guardar en base de datos si es pública
  if (isPublic) {
    gameDB.create(gameId, req.session.userId, gameName, totalPlayers, impostorCount);
  }

  // Notificar actualización de partidas
  io.emit('games-updated');

  const response = { 
    gameId, 
    link: `${req.protocol}://${req.get('host')}/game/${gameId}` 
  };
  
  // Agregar código si es privada
  if (gameCode) {
    response.gameCode = gameCode;
  }

  res.json(response);
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
    isPrivate: game.isPrivate || false,
    gameCode: game.gameCode || null
  });
});

// Función auxiliar para pasar al siguiente turno
function nextTurn(gameId, io, games) {
  const game = games.get(gameId);
  if (!game || !game.started) return;

  // Limpiar temporizador anterior si existe
  if (game.turnTimer) {
    clearInterval(game.turnTimer);
    clearTimeout(game.turnTimeout);
  }

  game.currentTurn = (game.currentTurn + 1) % game.players.length;
  game.turnPhase = 'writing';
  game.playerWroteWord = false; // Rastrear si escribió palabra
  game.timeRemaining = 90; // 90 segundos para escribir

  console.log(`➡️ Turno de ${game.players[game.currentTurn].name}`);

  // Enviar evento inicial de turno
  io.to(gameId).emit('next-turn', {
    currentTurn: game.currentTurn,
    playerName: game.players[game.currentTurn].name,
    phase: 'writing',
    timeRemaining: game.timeRemaining
  });

  // Actualizar tiempo cada segundo
  game.turnTimer = setInterval(() => {
    game.timeRemaining--;
    
    // Enviar actualización de tiempo a todos los clientes
    io.to(gameId).emit('timer-update', {
      timeRemaining: game.timeRemaining
    });

    if (game.timeRemaining <= 0) {
      clearInterval(game.turnTimer);
    }
  }, 1000);

  // Timeout automático después de 90 segundos
  game.turnTimeout = setTimeout(() => {
    if (!game.playerWroteWord) {
      console.log(`⏱️ Timeout automático: ${game.players[game.currentTurn].name} no escribió palabra`);
      io.to(gameId).emit('timeout-alert', {
        playerName: game.players[game.currentTurn].name,
        message: `⏰ ${game.players[game.currentTurn].name} no escribió ninguna palabra`
      });
    }
    // Limpiar timer y pasar al siguiente turno
    clearInterval(game.turnTimer);
    nextTurn(gameId, io, games);
  }, 90000);
}

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
  socket.on('join-game', ({ gameId, playerName, gameCode, avatar }) => {
    console.log(`🎮 Intento de unión - GameID: ${gameId}, Player: ${playerName}, Code: ${gameCode}, Avatar: ${avatar}`);
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

    // Permitir unirse solo si el juego NO ha empezado O si es reconexión
    if (game.started) {
      socket.emit('error', { message: 'La partida ya ha comenzado. No puedes unirte ahora.' });
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
      role: null,
      avatar: avatar || 'avatar1'
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
      players: game.players.map(p => ({ name: p.name, avatar: p.avatar })),
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

    // Lista de palabras secretas
    const palabras = [
      'GATO', 'PERRO', 'PLAYA', 'MONTAÑA', 'PIZZA', 'HELADO', 
      'CINE', 'MÚSICA', 'LIBRO', 'CAFÉ', 'FÚTBOL', 'VIAJE',
      'LUNA', 'SOL', 'ÁRBOL', 'FLOR', 'MAR', 'RÍO',
      'CIUDAD', 'PUEBLO', 'CASA', 'COCHE', 'AVIÓN', 'TREN'
    ];
    
    const palabraSecreta = palabras[Math.floor(Math.random() * palabras.length)];

    // Asignar roles aleatoriamente
    const playerIndices = Array.from({ length: game.players.length }, (_, i) => i);
    const shuffled = playerIndices.sort(() => Math.random() - 0.5);
    
    // Los primeros N son impostores
    const impostorIndices = shuffled.slice(0, game.impostorCount);
    
    console.log(`🎲 Asignando roles: ${game.impostorCount} impostores de ${game.players.length} jugadores`);
    console.log(`🎲 Índices de impostores:`, impostorIndices);

    game.players.forEach((player, index) => {
      player.role = impostorIndices.includes(index) ? 'impostor' : 'inocente';
      player.word = player.role === 'impostor' ? null : palabraSecreta;
      console.log(`   ${player.name}: ${player.role} ${player.word ? `(palabra: ${player.word})` : ''}`);
    });

    game.started = true;
    game.palabraSecreta = palabraSecreta;
    game.currentTurn = Math.floor(Math.random() * game.players.length); // Jugador inicial aleatorio
    game.turnPhase = 'writing'; // Iniciar directamente en fase de escritura
    game.messages = [];

    // Actualizar estado en base de datos
    if (game.isPublic) {
      gameDB.updateStatus(gameId, 'playing');
      io.emit('games-updated');
    }

    // Enviar información completa a cada jugador
    game.players.forEach((player, index) => {
      io.to(player.id).emit('game-started', {
        role: player.role,
        word: player.word,
        playerIndex: index,
        allPlayers: game.players.map(p => ({ name: p.name, avatar: p.avatar })),
        currentTurn: game.currentTurn,
        totalPlayers: game.players.length
      });
    });

    // Iniciar el primer turno inmediatamente
    game.playerWroteWord = false;
    game.timeRemaining = 90;
    
    // Enviar evento inicial de turno
    io.to(gameId).emit('next-turn', {
      currentTurn: game.currentTurn,
      playerName: game.players[game.currentTurn].name,
      phase: 'writing',
      timeRemaining: game.timeRemaining
    });

    // Actualizar tiempo cada segundo
    game.turnTimer = setInterval(() => {
      game.timeRemaining--;
      
      io.to(gameId).emit('timer-update', {
        timeRemaining: game.timeRemaining
      });

      if (game.timeRemaining <= 0) {
        clearInterval(game.turnTimer);
      }
    }, 1000);

    // Timeout automático
    game.turnTimeout = setTimeout(() => {
      if (!game.playerWroteWord) {
        console.log(`⏱️ Timeout automático: ${game.players[game.currentTurn].name} no escribió palabra`);
        io.to(gameId).emit('timeout-alert', {
          playerName: game.players[game.currentTurn].name,
          message: `⏰ ${game.players[game.currentTurn].name} no escribió ninguna palabra`
        });
      }
      clearInterval(game.turnTimer);
      nextTurn(gameId, io, games);
    }, 90000);

    console.log(`🎮 Partida ${gameId} iniciada - Palabra: ${palabraSecreta}`);
    console.log(`▶️ Primer turno: ${game.players[game.currentTurn].name} (índice ${game.currentTurn})`);
  });

  // Jugador escribe su palabra
  socket.on('submit-word', ({ gameId, word }) => {
    const game = games.get(gameId);
    if (!game || !game.started) return;

    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== game.currentTurn) return; // No es su turno

    console.log(`📝 ${game.players[playerIndex].name} escribió: ${word}`);

    game.playerWroteWord = true; // Marcar que escribió palabra

    // Limpiar temporizadores
    if (game.turnTimer) clearInterval(game.turnTimer);
    if (game.turnTimeout) clearTimeout(game.turnTimeout);

    // Notificar a todos que el jugador escribió su palabra
    io.to(gameId).emit('word-submitted', {
      playerIndex,
      playerName: game.players[playerIndex].name,
      word
    });

    // Pasar inmediatamente al siguiente turno
    nextTurn(gameId, io, games);
  });

  // El timeout ahora es manejado automáticamente desde nextTurn()

  // Mensaje de chat
  socket.on('send-message', ({ gameId, message }) => {
    const game = games.get(gameId);
    if (!game || !game.started) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    const chatMessage = {
      playerName: player.name,
      message,
      timestamp: Date.now()
    };

    game.messages.push(chatMessage);

    io.to(gameId).emit('new-message', chatMessage);
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

    // ============ EVENTOS PARA SISTEMA DE VOZ (WebRTC) ============
    
    socket.on('peer-ready', ({ gameId, peerId, playerName }) => {
      const game = games.get(gameId);
      if (!game) return;
      
      console.log(`🎤 Peer listo: ${playerName} (${peerId})`);
      
      // Guardar peerId en el jugador
      const player = game.players.find(p => p.name === playerName);
      if (player) {
        player.peerId = peerId;
      }
      
      // Notificar a otros jugadores que hay un nuevo peer disponible
      socket.to(gameId).emit('new-peer', { peerId, playerName });
    });
    
    socket.on('request-peers', ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) return;
      
      // Enviar lista de peers activos
      const peers = game.players
        .filter(p => p.peerId)
        .map(p => ({ peerId: p.peerId, playerName: p.name }));
      
      console.log(`📋 Enviando lista de ${peers.length} peers`);
      socket.emit('peers-list', { peers });
    });
    
    socket.on('mute-status', ({ gameId, playerName, isMuted }) => {
      const game = games.get(gameId);
      if (!game) return;
      
      // Notificar a todos sobre el cambio de estado de mute
      io.to(gameId).emit('mute-status-update', { playerName, isMuted });
    });

    socket.on('disconnect', () => {
      // Notificar que el peer se fue
      games.forEach((game, gameId) => {
        const player = game.players.find(p => p.id === socket.id);
        if (player && player.peerId) {
          io.to(gameId).emit('peer-left', { peerId: player.peerId, playerName: player.name });
        }
      });
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
