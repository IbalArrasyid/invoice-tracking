const jwt = require('jsonwebtoken');

/**
 * Middleware JWT — wajib dipasang di route yang butuh autentikasi.
 * Menerima token dari header: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan. Silakan login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}

/**
 * Middleware role guard — gunakan setelah authMiddleware.
 * Contoh: router.delete('/:id', authMiddleware, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Hak akses tidak mencukupi.' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
