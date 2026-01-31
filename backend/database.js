const { Pool } = require('pg');

/**
 * CONFIGURAÇÃO DE BANCO DE DATAS - SUPABASE
 * Correção para erro de certificado SSL no Render
 */

// Forçar a desativação da verificação de TLS para certificados autoassinados
// Isso resolve o erro "self-signed certificate in certificate chain"
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbConfig = {
  // Nota: A URL abaixo deve ser a sua URL de conexão do Supabase (Transaction Pooler)
  connectionString: 'postgresql://postgres.beffanooezicdxxldejx:fk8Fresqor2&@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false 
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
};

const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('❌ Erro no pool do PostgreSQL:', err.message);
});

const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('❌ Erro na query:', err.message);
    throw err;
  }
};

const initDb = async () => {
  console.log('🔄 Iniciando conexão com o banco de dados...');
  try {
    // Teste de conexão
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso!');
    
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
    console.log('💡 Dica: Verifique se a URL de conexão no arquivo database.js está correta e se o banco está ativo.');
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool
};
