require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sethi-draw-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Utilitário para gerar chaves de licença
 */
function generateLicenseKey(customerName) {
  const name = customerName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${name}-${randomNum}`;
}

/**
 * Middleware para autenticação administrativa
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Acesso negado');
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
}

// ==================== ROTAS ADMINISTRATIVAS ====================

// Login Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Senha incorreta' });
});

// Criar Licença
app.post('/api/admin/licenses', authenticateAdmin, async (req, res) => {
  try {
    const { customer_name, notes } = req.body;
    if (!customer_name) {
      return res.status(400).json({ success: false, message: 'Nome do cliente é obrigatório' });
    }

    const license_key = generateLicenseKey(customer_name);
    
    await db.query(
      'INSERT INTO licenses (license_key, customer_name, notes, status) VALUES ($1, $2, $3, $4)',
      [license_key, customer_name, notes || '', 'inactive']
    );

    res.json({
      success: true,
      license: { license_key, customer_name, status: 'inactive' }
    });
  } catch (err) {
    console.error('Erro ao criar licença:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao salvar no banco de dados' });
  }
});

// Listar Licenças
app.get('/api/admin/licenses', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM licenses ORDER BY created_at DESC');
    res.json({ success: true, licenses: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar licenças' });
  }
});

// Estatísticas
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked
      FROM licenses
    `);
    
    const s = stats.rows[0];
    res.json({
      success: true,
      stats: {
        total: parseInt(s.total),
        active: parseInt(s.active),
        inactive: parseInt(s.inactive),
        revoked: parseInt(s.revoked)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao calcular estatísticas' });
  }
});

// Revogar Licença
app.post('/api/admin/licenses/:key/revoke', authenticateAdmin, async (req, res) => {
  try {
    await db.query(
      "UPDATE licenses SET status = 'revoked', device_id = NULL WHERE license_key = $1",
      [req.params.key]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao revogar' });
  }
});

// Deletar Licença
app.delete('/api/admin/licenses/:key', authenticateAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM licenses WHERE license_key = $1', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao deletar' });
  }
});

// Histórico
app.get('/api/admin/licenses/:key/history', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM activation_history WHERE license_key = $1 ORDER BY timestamp DESC',
      [req.params.key]
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar histórico' });
  }
});

// ==================== ROTAS DO CLIENTE ====================

// Ativar
app.post('/api/license/activate', async (req, res) => {
  try {
    const { license_key, device_id, device_info } = req.body;
    const result = await db.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const license = result.rows[0];

    if (!license) return res.status(404).json({ success: false, message: 'Chave inválida' });
    if (license.status === 'revoked') return res.status(403).json({ success: false, message: 'Licença revogada' });

    // Atualizar
    await db.query(
      `UPDATE licenses SET 
        device_id = $1, device_info = $2, status = 'active', 
        activated_at = NOW(), last_validation = NOW() 
       WHERE license_key = $3`,
      [device_id, device_info || '', license_key]
    );

    // Log
    await db.query(
      'INSERT INTO activation_history (license_key, device_id, device_info, action) VALUES ($1, $2, $3, $4)',
      [license_key, device_id, device_info || '', 'ACTIVATED']
    );

    const token = jwt.sign(
      { license_key, device_id, customer_name: license.customer_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, customer_name: license.customer_name });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// Validar
app.post('/api/license/validate', async (req, res) => {
  try {
    const { token, device_id } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await db.query(
      "SELECT * FROM licenses WHERE license_key = $1 AND device_id = $2 AND status = 'active'",
      [decoded.license_key, device_id]
    );

    if (result.rows.length === 0) return res.status(401).json({ success: false });

    await db.query('UPDATE licenses SET last_validation = NOW() WHERE license_key = $1', [decoded.license_key]);
    res.json({ success: true, customer_name: result.rows[0].customer_name });
  } catch (err) {
    res.status(401).json({ success: false });
  }
});

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Inicialização
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔑 Senha Admin: ${ADMIN_PASSWORD}`);
  });
});
