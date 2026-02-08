const { Pool } = require('pg');

/**
 * CONFIGURAÇÃO DE BANCO DE DADOS - SUPABASE / RENDER
 * Esta configuração resolve problemas de SSL e facilita a troca da URL de conexão.
 */

// Desativa a verificação de TLS para aceitar certificados autoassinados (comum no Render/Supabase)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbConfig = {
  // Prioriza a variável de ambiente DATABASE_URL do Render
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.beffanooezicdxxldejx:fk8Fresqor2&@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
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
    
    if (err.message.includes('Tenant or user not found')) {
      console.log('\n--- 💡 DICA DE SOLUÇÃO ---');
      console.log('O erro "Tenant or user not found" indica que a URL de conexão está incorreta.');
      console.log('1. Vá ao painel do Supabase > Project Settings > Database.');
      console.log('2. Procure por "Connection String" e selecione a aba "URI".');
      console.log('3. Certifique-se de usar o modo "Transaction" (porta 6543).');
      console.log('4. No Render, adicione uma variável de ambiente chamada DATABASE_URL com essa nova URI.');
      console.log('---------------------------\n');
    }
    
    return false;
  }
};

module.exports = {
  query,
  initDb,
  pool
};
