const { Pool } = require('pg');

// URI do Transaction Pooler do Supabase (Ideal para o Render)
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.beffanooezicdxxldejx:fk8Fresqor2&@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Configurações otimizadas para Pooler
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const initDb = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Conectado ao banco de dados PostgreSQL via Pooler (Supabase)');
    
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

    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_device_id ON licenses(device_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_status ON licenses(status)`);

    console.log('✅ Tabelas inicializadas com sucesso no PostgreSQL');
  } catch (err) {
    console.error('❌ Erro de conexão com o banco de dados:', err.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
