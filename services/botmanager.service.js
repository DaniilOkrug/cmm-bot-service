const userBotModel = require("../models/General/userBot.model");
const botService = require("./bot.service");

class botManagerService {
    start() {
        return new Promise(async (resolve, reject) => {
            try {
                const freeBots = await userBotModel.find({ status: "Wait" });

                for (const botInfo of freeBots) {
                    await botService.start(botInfo._id.toString());
                }

                resolve();
            } catch (err) {
                console.log(err);
            }
        });
    }
}

module.exports = new botManagerService();