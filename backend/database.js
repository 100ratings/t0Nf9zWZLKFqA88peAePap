const { Pool } = require('pg');

// URI do Pooler do Supabase
const connectionString = 'postgresql://postgres.beffanooezicdxxldejx:fk8Fresqor2&@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Tratamento de erros no pool para evitar queda do servidor
pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err.message);
});

/**
 * Executa uma query de forma segura com tratamento de erros
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('Executada query:', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('❌ Erro na execução da query:', { text, error: err.message });
    throw err;
  }
};

/**
 * Inicializa as tabelas no PostgreSQL
 */
const initDb = async () => {
  console.log('🔄 Iniciando conexão com o banco de dados...');
  
  try {
    // Testar conexão
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso com o Supabase');

    // Tabela de Licenças
    await query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        license_key TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        device_id TEXT,
        device_info TEXT,
        status TEXT DEFAULT 'inactive',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP WITH TIME ZONE,
        last_validation TIMESTAMP WITH TIME ZONE,
        notes TEXT
      )
    `);

    // Tabela de Histórico
    await query(`
      CREATE TABLE IF NOT EXISTS activation_history (
        id SERIAL PRIMARY KEY,
        license_key TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_info TEXT,
        action TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_license_key FOREIGN KEY (license_key) REFERENCES licenses(license_key) ON DELETE CASCADE
      )
    `);

    // Índices
    await query(`CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_status ON licenses(status)`);

    console.log('✅ Estrutura do banco de dados verificada e pronta.');
    return true;
  } catch (err) {
    console.error('❌ Falha crítica na inicialização do banco:', err.message);
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool
};
