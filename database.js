const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Crear/abrir base de datos
const db = new Database(path.join(__dirname, 'impostor.db'));

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    times_impostor INTEGER DEFAULT 0,
    times_innocent INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    role TEXT NOT NULL,
    won BOOLEAN DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS active_games (
    id TEXT PRIMARY KEY,
    creator_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    total_players INTEGER NOT NULL,
    impostor_count INTEGER NOT NULL,
    current_players INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  );
`);

// Funciones de usuario
const userDB = {
  // Crear usuario
  create: (username, email, password) => {
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
      const result = stmt.run(username, email, hashedPassword);
      return { id: result.lastInsertRowid, username, email };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('username')) {
          throw new Error('El nombre de usuario ya está en uso');
        }
        if (error.message.includes('email')) {
          throw new Error('El email ya está registrado');
        }
      }
      throw error;
    }
  },

  // Encontrar por username
  findByUsername: (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  },

  // Encontrar por email
  findByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  // Encontrar por ID
  findById: (id) => {
    const stmt = db.prepare('SELECT id, username, email, games_played, games_won, times_impostor, times_innocent FROM users WHERE id = ?');
    return stmt.get(id);
  },

  // Verificar contraseña
  verifyPassword: (password, hashedPassword) => {
    return bcrypt.compareSync(password, hashedPassword);
  },

  // Actualizar estadísticas
  updateStats: (userId, stats) => {
    const stmt = db.prepare(`
      UPDATE users 
      SET games_played = games_played + 1,
          games_won = games_won + ?,
          times_impostor = times_impostor + ?,
          times_innocent = times_innocent + ?
      WHERE id = ?
    `);
    stmt.run(stats.won ? 1 : 0, stats.wasImpostor ? 1 : 0, stats.wasImpostor ? 0 : 1, userId);
  },

  // Obtener ranking
  getLeaderboard: (limit = 10) => {
    const stmt = db.prepare(`
      SELECT username, games_played, games_won, times_impostor
      FROM users 
      ORDER BY games_won DESC, games_played DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // ============ FUNCIONES SUPER ADMIN ============
  
  // Obtener todos los usuarios
  getAllUsers: () => {
    const stmt = db.prepare(`
      SELECT id, username, email, created_at, games_played, games_won, 
             times_impostor, times_innocent
      FROM users 
      ORDER BY created_at DESC
    `);
    return stmt.all();
  },

  // Obtener historial de un usuario específico
  getUserHistory: (userId) => {
    const stmt = db.prepare(`
      SELECT gh.*, u.username
      FROM game_history gh
      JOIN users u ON gh.user_id = u.id
      WHERE gh.user_id = ?
      ORDER BY gh.played_at DESC
    `);
    return stmt.all(userId);
  },

  // Obtener estadísticas globales
  getGlobalStats: () => {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(games_played) as total_games,
        SUM(games_won) as total_wins
      FROM users
    `);
    return stmt.get();
  }
};

// Funciones de partidas
const gameDB = {
  // Crear partida pública
  create: (gameId, creatorId, name, totalPlayers, impostorCount) => {
    const stmt = db.prepare(`
      INSERT INTO active_games (id, creator_id, name, total_players, impostor_count)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(gameId, creatorId, name, totalPlayers, impostorCount);
  },

  // Obtener todas las partidas disponibles
  getAvailable: () => {
    const stmt = db.prepare(`
      SELECT g.*, u.username as creator_name 
      FROM active_games g
      JOIN users u ON g.creator_id = u.id
      WHERE g.status = 'waiting'
      ORDER BY g.created_at DESC
    `);
    return stmt.all();
  },

  // Actualizar jugadores actuales
  updatePlayerCount: (gameId, count) => {
    const stmt = db.prepare('UPDATE active_games SET current_players = ? WHERE id = ?');
    stmt.run(count, gameId);
  },

  // Actualizar estado
  updateStatus: (gameId, status) => {
    const stmt = db.prepare('UPDATE active_games SET status = ? WHERE id = ?');
    stmt.run(status, gameId);
  },

  // Eliminar partida
  delete: (gameId) => {
    const stmt = db.prepare('DELETE FROM active_games WHERE id = ?');
    stmt.run(gameId);
  },

  // Guardar historial
  saveHistory: (userId, gameId, role, won) => {
    const stmt = db.prepare(`
      INSERT INTO game_history (user_id, game_id, role, won)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, gameId, role, won ? 1 : 0);
  },

  // ============ FUNCIONES SUPER ADMIN ============
  
  // Obtener todas las partidas (activas e históricas)
  getAllGames: () => {
    const stmt = db.prepare(`
      SELECT g.*, u.username as creator_name 
      FROM active_games g
      JOIN users u ON g.creator_id = u.id
      ORDER BY g.created_at DESC
      LIMIT 100
    `);
    return stmt.all();
  },

  // Obtener historial completo de partidas
  getGameHistory: (limit = 100) => {
    const stmt = db.prepare(`
      SELECT gh.*, u.username
      FROM game_history gh
      JOIN users u ON gh.user_id = u.id
      ORDER BY gh.played_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
};

module.exports = { db, userDB, gameDB };
