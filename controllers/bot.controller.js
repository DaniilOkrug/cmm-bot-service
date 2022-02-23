const botService = require('../services/bot.service');

class BotController {
    async start(req, res, next) {
        try {
            const { botId } = req.body;

            const response = await botService.start(botId);

            res.json({});
        } catch (err) {
            console.log(err);
            next();
        }
    }

    async delete(req, res, next) {
        try {
            const { botId } = req.body;

            const response = await botService.delete(botId);

            res.json(response);
        } catch (err) {
            console.log(err);
            next();
        }
    }

    async stop(req, res, next) {
        try {
            const { botId } = req.body;

            const response = await botService.stop(botId);

            res.json(response);
        } catch (err) {
            console.log(err);
            next();
        }
    }
}

module.exports = new BotController;