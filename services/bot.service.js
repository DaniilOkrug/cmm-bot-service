const apiWorkerManager = (require('../worker/apiWorkerManager/index')).getInstance();
const dcaWorkerManager = (require('../worker/dcaWorkerManager/index')).getInstance();

const userBotModel = require('../models/General/userBot.model');
const botModel = require('../models/General/bot.model');
const apiModel = require('../models/General/api.model');

class BotService {
    async start(botId) {
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);
        const botData = await botModel.findById(userBotData.bot);

        const apiStatus = await apiWorkerManager.checkAPI(apiData.key, apiData.secret);

        const botSettings = {
            ...botData.settings,
            pair: userBotData.pair,
            deposit: userBotData.deposit
        }
        if (apiStatus) {
            console.log('API existed');
            const apiChannel = apiWorkerManager.getChannel(apiData.key, apiData.secret);
            dcaWorkerManager.createWorker(botId, apiData.key, apiData.secret, botSettings);
        } else {
            const apiChannel = await apiWorkerManager.createWorker(apiData.key, apiData.secret);
            await dcaWorkerManager.createWorker(botId, apiData.key, apiData.secret, botSettings);;
        }

        return {}
    }

    async stop(botId) {
        await dcaWorkerManager.stopWorker(botId);

        return { message: "Stopping" }
    }

    async delete(botId) {
        const userBotData = await userBotModel.findById(botId);
        const apiData = await apiModel.findById(userBotData.api);

        await dcaWorkerManager.deleteWorker(botId);
        const apiBots = dcaWorkerManager.getWorkers(apiData.key, apiData.secret);

        if (apiBots.length == 0) {
            apiWorkerManager.deleteWorker(apiData.key, apiData.secret);
        }

        return { message: "Deleted" };
    }
}

module.exports = new BotService();