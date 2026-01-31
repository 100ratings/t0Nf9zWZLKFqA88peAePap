const { Pool } = require('pg');

// URI de conexão com o Supabase ajustada para forçar IPv4
// Adicionado ?sslmode=require para maior estabilidade
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:fk8Fresqor2&@db.beffanooezicdxxldejx.supabase.co:5432/postgres?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Configurações extras para evitar erros de conexão em redes restritas
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Função para inicializar as tabelas no PostgreSQL
const initDb = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado ao banco de dados PostgreSQL (Supabase)');
    
    // Criar tabela de licenças
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        license_key TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        device_id TEXT,
        device_info TEXT,
        status TEXT DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP,
        last_validation TIMESTAMP,
        notes TEXT
      )
    `);

    // Criar tabela de histórico
    await client.query(`
      CREATE TABLE IF NOT EXISTS activation_history (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_info TEXT,
        action TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_license_key FOREIGN KEY (license_key) REFERENCES licenses(license_key) ON DELETE CASCADE
      )
    `);

    // Criar índices
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_device_id ON licenses(device_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_status ON licenses(status)`);

    console.log('✅ Tabelas inicializadas com sucesso no PostgreSQL');
  } catch (err) {
    console.error('❌ Erro ao conectar ou inicializar banco de dados:', err.message);
    // Não mata o processo, permite que o servidor tente reconectar depois
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
