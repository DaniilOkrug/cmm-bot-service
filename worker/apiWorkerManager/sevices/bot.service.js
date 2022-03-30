const userBotModel = require('../../../models/General/userBot.model');
const botModel = require('../../../models/General/bot.model');
const apiModel = require('../../../models/General/api.model');

class BotService {
    getBotConfiguration(pair, key, secret) {
        return new Promise(async (resolve, reject) => {
            try {
                const userApi = await apiModel.findOne({ key, secret });

                if (typeof userApi === 'undefined') {
                    throw new Error("Api doesn't exists!");
                }

                const availableUserBot = await userBotModel.findOneAndUpdate({ api: userApi._id, status: "Wait" }, { status: "Active" });
                
                if (typeof availableUserBot === 'undefined') resolve();

                console.log(availableUserBot);

                const botSettings = (await botModel.find())[0].settings;
                botSettings.pair = pair;
                botSettings.deposit = availableUserBot.deposit;

                resolve({
                    key,
                    secret,
                    botSettings,
                    botId: availableUserBot._id.toString()
                })
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = new BotService();