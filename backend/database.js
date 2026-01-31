const { Pool } = require('pg');

/**
 * CONFIGURAÇÃO DEFINITIVA - SUPABASE VIA POOLER (PORTA 6543)
 * Ideal para Render.com (Plano Gratuito)
 */
const dbConfig = {
  connectionString: 'postgresql://postgres.beffanooezicdxxldejx:fk8Fresqor2&@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supavisor_session_id=sethi_draw_session',
  ssl: {
    rejectUnauthorized: false
  },
  max: 5, // Reduzido para maior estabilidade no plano gratuito
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
};

const pool = new Pool(dbConfig);

// Tratamento de erros no pool para evitar queda do servidor
pool.on('error', (err) => {
  console.error('❌ Erro no pool do PostgreSQL:', err.message);
});

/**
 * Executa uma query com tentativa de reconexão automática
 */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('❌ Erro na query (tentando reconectar):', err.message);
    // Se a conexão caiu, tentamos uma vez mais
    return await pool.query(text, params);
  }
};

/**
 * Inicializa as tabelas
 */
const initDb = async () => {
  console.log('🔄 Iniciando conexão via Transaction Pooler (Porta 6543)...');
  try {
    // Teste de conexão com retry
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso com o Supabase via Pooler');
    
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
    // Não travamos o servidor, permitimos que ele tente conectar nas requisições
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool
};
