const Router = require('express').Router;
const botController = require('../controllers/bot.controller');
const router = new Router();


router.post('/start', botController.start);
router.post('/delete', botController.delete);
router.post('/stop', botController.stop);

module.exports = router;