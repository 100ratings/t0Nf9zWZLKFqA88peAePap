const { Pool } = require('pg');

/**
 * CONFIGURAÇÃO DE CONEXÃO - SUPABASE
 * Usando codificação para caracteres especiais na senha (como o &)
 */
const dbConfig = {
  user: 'postgres.beffanooezicdxxldejx',
  host: 'aws-1-sa-east-1.pooler.supabase.com',
  database: 'postgres',
  password: 'fk8Fresqor2&',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

const pool = new Pool(dbConfig);

// Tratamento de erros no pool
pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err.message);
});

/**
 * Executa uma query de forma segura
 */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('❌ Erro na execução da query:', err.message);
    throw err;
  }
};

/**
 * Inicializa as tabelas
 */
const initDb = async () => {
  console.log('🔄 Iniciando conexão direta com o banco de dados (Porta 5432)...');
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso com o Supabase');
    
    // Garantir que as tabelas existam
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

    console.log('✅ Estrutura do banco de dados pronta.');
    return true;
  } catch (err) {
    console.error('❌ Falha na inicialização do banco:', err.message);
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool
};
