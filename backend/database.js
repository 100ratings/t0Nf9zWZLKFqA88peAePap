const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'licenses.db'), (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite');
  }
});

// Criar tabelas
db.serialize(() => {
  // Criar tabela de licenças
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      device_id TEXT,
      device_info TEXT,
      status TEXT DEFAULT 'inactive',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_at DATETIME,
      last_validation DATETIME,
      notes TEXT
    )
  `);

  // Criar tabela de histórico de ativações
  db.run(`
    CREATE TABLE IF NOT EXISTS activation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_info TEXT,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (license_key) REFERENCES licenses(license_key)
    )
  `);

  // Criar índices para melhor performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_id ON licenses(device_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON licenses(status)`);
});

console.log('✅ Banco de dados inicializado com sucesso');

module.exports = db;
