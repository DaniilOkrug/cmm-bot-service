const apiWorkerManager = require('../worker/apiWorkerManager/index');
const userBotModel = require('../models/General/userBot.model');
const botModel = require('../models/General/bot.model');
const apiModel = require('../models/General/api.model');
const botManager = require('../worker/botManager');

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

        botManager.stopBot(apiData.key, apiData.secret, botId);

        return { status: "Stopping" }
    }

    async delete(botId) {
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);

        botManager.deleteBot(apiData.key, apiData.secret, botId)
            .finally(() => {
                console.error('Promise -> Deleting bot error');
                return { status: "Disabled" };
            });
    }

    async updateSettings() {
        const botData = (await botModel.find())[0];

        botManager.updateBotSettings(botData.settings);
    }
}

module.exports = new BotService();