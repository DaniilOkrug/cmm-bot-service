const apiWorkerManager = require('../worker/apiWorkerManager/index');
const analyzerService = (require('./analyzer.service')).getInstance();
const userBotModel = require('../models/General/userBot.model');
const botModel = require('../models/General/bot.model');
const apiModel = require('../models/General/api.model');
const botManager = require('../worker/botManager');
const { logger } = require('../utils/logger/logger');

class BotService {
    async start(botId) {
        const botData = (await botModel.find())[0];
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);

        const isApiExists = apiWorkerManager.checkAPI(apiData.key, apiData.secret);
        const isBotManagerExists = botManager.isActive(apiData.key, apiData.secret);

        if (!isApiExists) {
            await apiWorkerManager.createWorker(apiData.key, apiData.secret);
        }

        if (!isBotManagerExists) {
            await botManager.createWorker(apiData.key, apiData.secret, botData.settings);
        }

        await botManager.addBot(apiData.key, apiData.secret, botId, userBotData.deposit);

        return {
            status: 'Wait'
        }
    }

    async stop(botId) {
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);

        const botStatus = await botManager.stopBot(apiData.key, apiData.secret, botId)

        return { status: botStatus };
    }

    async stopAll(botIds) {
        console.log(botIds);
        for (const botId of botIds) {
            const userBotData = await userBotModel.findById(botId);
            const apiData = await apiModel.findById(userBotData.api);

            await botManager.stopBot(apiData.key, apiData.secret, botId)
        }

        return {};
    }

    async delete(botId) {
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);

        try {
            await botManager.deleteBot(apiData.key, apiData.secret, botId)
        } catch (error) {
            console.error('Promise -> Deleting bot error');
            console.log(error);
            logger.error(err);
        }

        return { status: "Disabled" };
    }

    async updateSettings() {
        const botData = (await botModel.find())[0];

        try {
            await botManager.updateBotSettings(botData.settings);

            const settings = JSON.parse(JSON.stringify(botData.settings.analyzer));
            settings.algorithm = botData.settings.algorithm;
            analyzerService.updateSettings(botData.pairs, settings);
        } catch (err) {
            logger.error(err);
            return { status: "Error", message: err }
        }

        return { status: "Updated" };
    }

    async updateBlacklist() {
        const botData = (await botModel.find())[0];
        
        analyzerService.updateBlacklist(botData._doc.blacklist);

        return { status: "Updated" };
    }
}

module.exports = new BotService();