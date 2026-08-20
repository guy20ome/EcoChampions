const express = require('express');
const router = express.Router();
const pollutionController = require('../controllers/pollution');

// GET /api/leaderboard - get global leaderboard
router.get('/', pollutionController.getLeaderboard);

module.exports = router;