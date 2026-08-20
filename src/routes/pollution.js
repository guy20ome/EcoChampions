const express = require('express');
const router = express.Router();
const pollutionController = require('../controllers/pollution');

router.post('/log', pollutionController.logPollution);
router.get('/leaderboard', pollutionController.getLeaderboard);

module.exports = router;