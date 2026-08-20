/**
 * Express API Entry Point - MVP Implementation
 *
 * This starts the server for the Ecology Champions MVP:
 * - Basic auth routes (/api/auth)
 * - Pollution tracking routes (/api/pollution)
 * - Leaderboard routes (/api/leaderboards)
 * - Basic health check route (/health)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

const authRoutes = require('./routes/auth');
const pollutionRoutes = require('./routes/pollution');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/pollution', pollutionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Database connection
const dbStart = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ecology_champions',
      multipleStatements: true
    });

    // Test connection
    await connection.query('SELECT 1');
    console.log('✅ Database connected successfully');

    // Start server after DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });

  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
};

dbStart();

// Handle unhandled rejections/promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', reason.stack || reason);
  process.exit(1);
});