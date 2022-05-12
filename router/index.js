const Router = require('express').Router;
const botController = require('../controllers/bot.controller');
const router = new Router();


router.post('/start', botController.start);
router.post('/delete', botController.delete);
router.post('/stop', botController.stop);
router.post('/stopAll', botController.stopAll);
router.post('/checkApi', botController.check);
router.get('/updateSettings', botController.updateSettings);
router.get('/updateBlacklist', botController.updateBlacklist);
router.get('/pairs', botController.getPairs)

module.exports = router;