const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');

const getDashboard = asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT * FROM user_dashboard_stats WHERE user_id = $1',
    [req.user.id]
  );

  res.json({
    success: true,
    data: result.rows[0] || {
      user_id: req.user.id,
      total_domains: 0,
      free_domains: 0,
      paid_domains: 0,
      total_payments: 0,
      total_spent: 0,
      verification_requests: 0,
      approved_verifications: 0,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await db.query(
    'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [email, req.user.id]
  );

  res.json({ success: true, data: result.rows[0] });
});

module.exports = {
  getDashboard,
  updateProfile,
};
