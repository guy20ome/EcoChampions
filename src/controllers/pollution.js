const mysql = require('mysql2/promise');

exports.logPollution = async (req, res) => {
  const { user_id, pollution_type, pollution_value, date } = req.body;

  try {
    if (!user_id || !pollution_type || !pollution_value || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (pollution_value <= 0) {
      return res.status(400).json({ error: 'Pollution value must be positive' });
    }

    const [result] = await mysql.query(
      'INSERT INTO pollution_logs (user_id, pollution_type, pollution_value, date) VALUES (?, ?, ?, ?)',
      [user_id, pollution_type, pollution_value, date]
    );

    res.status(201).json({ message: 'Pollution logged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log pollution' });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const [rows] = await mysql.query(`
      SELECT
        u.id,
        u.username,
        SUM(p.pollution_value) AS total_pollution
      FROM users u
      JOIN pollution_logs p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY total_pollution ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};