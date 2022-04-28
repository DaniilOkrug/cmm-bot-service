const apiService = require('../services/api.service');
const botService = require('../services/bot.service');

class BotController {
    async start(req, res, next) {
        try {
            const { botId } = req.body;

            const response = await botService.start(botId);

            res.json(response);
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
            next(err);
        }
    }

    async stop(req, res, next) {
        try {
            const { botId } = req.body;

            const response = await botService.stop(botId);

            res.json(response);
        } catch (err) {
            console.log(err);
            next(err);
        }
    }

    async check(req, res, next) {
        try {
            const { key, secret, exchange } = req.body;

            const response = await apiService.checkApi(key, secret, exchange);

            res.json(response);
        } catch (err) {
            next(err);
        }
    }

    async updateSettings(req, res, next) {
        try {
            const response = await botService.updateSettings();
            res.json(response);
        } catch (err) {
            next(err);
        }
    }

    async updateBlacklist(req, res, next) {
        try {
            const response = await botService.updateBlacklist();
            res.json(response);
        } catch (err) {
            next(err);
        }
    }

    async getPairs(req, res, next) {
        try {

            const response = await apiService.getPairs();

            res.json(response);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new BotController;