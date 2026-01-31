require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sethi-draw-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(express.json());

// Função para gerar chave de licença
function generateLicenseKey(customerName) {
  const name = customerName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 10);
  const randomNum = Math.floor(Math.random() * 900) + 100;
  return `${name}-${randomNum}`;
}

// Função para registrar histórico
async function logActivation(licenseKey, deviceId, deviceInfo, action) {
  try {
    await db.query(
      `INSERT INTO activation_history (license_key, device_id, device_info, action) VALUES ($1, $2, $3, $4)`,
      [licenseKey, deviceId, deviceInfo, action]
    );
  } catch (err) {
    console.error('Erro ao registrar histórico:', err);
  }
}

// ==================== ROTAS DE LICENÇA ====================

// Ativar licença
app.post('/api/license/activate', async (req, res) => {
  try {
    const { license_key, device_id, device_info } = req.body;

    if (!license_key || !device_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Chave de licença e ID do dispositivo são obrigatórios' 
      });
    }

    // Verificar se a licença existe
    const licenseRes = await db.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const license = licenseRes.rows[0];

    if (!license) {
      return res.status(404).json({ 
        success: false, 
        message: 'Licença não encontrada. Verifique a chave digitada.' 
      });
    }

    // Se a licença já está ativa em outro dispositivo, desativar
    if (license.status === 'active' && license.device_id !== device_id) {
      await logActivation(license_key, license.device_id, license.device_info, 'DEACTIVATED');
      console.log(`🔄 Licença ${license_key} desativada do dispositivo anterior: ${license.device_id}`);
    }

    // Ativar licença no novo dispositivo
    await db.query(
      `UPDATE licenses 
       SET device_id = $1, device_info = $2, status = 'active', 
           activated_at = CURRENT_TIMESTAMP, last_validation = CURRENT_TIMESTAMP
       WHERE license_key = $3`,
      [device_id, device_info || '', license_key]
    );

    // Registrar ativação no histórico
    await logActivation(license_key, device_id, device_info || '', 'ACTIVATED');

    // Gerar token JWT
    const token = jwt.sign(
      { license_key, device_id, customer_name: license.customer_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`✅ Licença ${license_key} ativada no dispositivo: ${device_id}`);

    res.json({
      success: true,
      message: 'Licença ativada com sucesso!',
      token,
      customer_name: license.customer_name
    });

  } catch (error) {
    console.error('Erro ao ativar licença:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// Validar licença
app.post('/api/license/validate', async (req, res) => {
  try {
    const { token, device_id } = req.body;

    if (!token || !device_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token e ID do dispositivo são obrigatórios' 
      });
    }

    // Verificar token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido ou expirado' 
      });
    }

    // Verificar se a licença ainda está ativa no dispositivo correto
    const licenseRes = await db.query(
      `SELECT * FROM licenses WHERE license_key = $1 AND device_id = $2 AND status = 'active'`,
      [decoded.license_key, device_id]
    );
    const license = licenseRes.rows[0];

    if (!license) {
      return res.status(403).json({ 
        success: false, 
        message: 'Licença não está ativa neste dispositivo' 
      });
    }

    // Atualizar última validação
    await db.query(
      `UPDATE licenses SET last_validation = CURRENT_TIMESTAMP WHERE license_key = $1`,
      [decoded.license_key]
    );

    res.json({
      success: true,
      message: 'Licença válida',
      customer_name: license.customer_name
    });

  } catch (error) {
    console.error('Erro ao validar licença:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// Obter status da licença
app.get('/api/license/status/:license_key', async (req, res) => {
  try {
    const { license_key } = req.params;

    const licenseRes = await db.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const license = licenseRes.rows[0];

    if (!license) {
      return res.status(404).json({ success: false, message: 'Licença não encontrada' });
    }

    res.json({
      success: true,
      license: {
        license_key: license.license_key,
        customer_name: license.customer_name,
        status: license.status,
        device_id: license.device_id,
        activated_at: license.activated_at,
        last_validation: license.last_validation
      }
    });

  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// ==================== ROTAS ADMINISTRATIVAS ====================

// Middleware de autenticação admin
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Não autorizado' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
}

// Login admin
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Senha é obrigatória' });
    }

    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
  } catch (error) {
    console.error('Erro no login admin:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
});

// Criar nova licença
app.post('/api/admin/licenses', authenticateAdmin, async (req, res) => {
  try {
    const { customer_name, notes } = req.body;

    if (!customer_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome do cliente é obrigatório' 
      });
    }

    const license_key = generateLicenseKey(customer_name);

    await db.query(
      `INSERT INTO licenses (license_key, customer_name, notes) VALUES ($1, $2, $3)`,
      [license_key, customer_name, notes || '']
    );

    console.log(`🆕 Nova licença criada: ${license_key} para ${customer_name}`);

    res.json({
      success: true,
      message: 'Licença criada com sucesso',
      license: {
        license_key,
        customer_name,
        status: 'inactive',
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao criar licença:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar licença' });
  }
});

// Listar todas as licenças
app.get('/api/admin/licenses', authenticateAdmin, async (req, res) => {
  try {
    const licensesRes = await db.query('SELECT * FROM licenses ORDER BY created_at DESC');
    res.json({ success: true, licenses: licensesRes.rows });
  } catch (error) {
    console.error('Erro ao listar licenças:', error);
    res.status(500).json({ success: false, message: 'Erro ao listar licenças' });
  }
});

// Revogar licença
app.post('/api/admin/licenses/:license_key/revoke', authenticateAdmin, async (req, res) => {
  try {
    const { license_key } = req.params;

    const licenseRes = await db.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const license = licenseRes.rows[0];

    if (!license) {
      return res.status(404).json({ success: false, message: 'Licença não encontrada' });
    }

    await db.query(
      `UPDATE licenses SET status = 'revoked', device_id = NULL WHERE license_key = $1`,
      [license_key]
    );

    await logActivation(license_key, license.device_id || 'N/A', '', 'REVOKED');
    console.log(`🚫 Licença ${license_key} revogada`);

    res.json({ success: true, message: 'Licença revogada com sucesso' });

  } catch (error) {
    console.error('Erro ao revogar licença:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// Deletar licença
app.delete('/api/admin/licenses/:license_key', authenticateAdmin, async (req, res) => {
  try {
    const { license_key } = req.params;

    await db.query('DELETE FROM activation_history WHERE license_key = $1', [license_key]);
    await db.query('DELETE FROM licenses WHERE license_key = $1', [license_key]);

    console.log(`🗑️ Licença ${license_key} deletada`);
    res.json({ success: true, message: 'Licença deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar licença:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar licença' });
  }
});

// Obter histórico de ativações
app.get('/api/admin/licenses/:license_key/history', authenticateAdmin, async (req, res) => {
  try {
    const { license_key } = req.params;

    const historyRes = await db.query(
      `SELECT * FROM activation_history WHERE license_key = $1 ORDER BY timestamp DESC`,
      [license_key]
    );
    res.json({ success: true, history: historyRes.rows });

  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter histórico' });
  }
});

// Estatísticas
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalRes = await db.query('SELECT COUNT(*) as total FROM licenses');
    const activeRes = await db.query('SELECT COUNT(*) as active FROM licenses WHERE status = $1', ['active']);
    const inactiveRes = await db.query('SELECT COUNT(*) as inactive FROM licenses WHERE status = $1', ['inactive']);
    const revokedRes = await db.query('SELECT COUNT(*) as revoked FROM licenses WHERE status = $1', ['revoked']);

    res.json({
      success: true,
      stats: {
        total: parseInt(totalRes.rows[0].total),
        active: parseInt(activeRes.rows[0].active),
        inactive: parseInt(inactiveRes.rows[0].inactive),
        revoked: parseInt(revokedRes.rows[0].revoked)
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter estatísticas' });
  }
});

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'SETHIR DRAW License Server está rodando!',
    timestamp: new Date().toISOString()
  });
});

// Inicializar banco de dados e Iniciar servidor
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 SETHIR DRAW License Server rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Admin password: ${ADMIN_PASSWORD}\n`);
  });
});

module.exports = app;
