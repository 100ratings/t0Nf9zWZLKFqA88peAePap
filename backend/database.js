const { Pool } = require('pg');

// URI de conexão com o Supabase
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:fk8Fresqor2&@db.beffanooezicdxxldejx.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Necessário para conexões externas com o Supabase
  }
});

// Função para inicializar as tabelas no PostgreSQL
const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('✅ Conectado ao banco de dados PostgreSQL (Supabase)');
    
    // Criar tabela de licenças (Sintaxe Postgres)
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

    // Criar tabela de histórico de ativações (Sintaxe Postgres)
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
    console.error('❌ Erro ao inicializar banco de dados:', err);
  } finally {
    client.release();
  }
};

// Exportar o pool e a função de inicialização
module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
