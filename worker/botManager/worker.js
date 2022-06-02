const { parentPort, workerData } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const dcaWorkerManager = require("../dcaWorkerManager");
const { logger } = require('../../utils/logger/logger');

console.log("New Bot Manager");

const dataWorker = JSON.parse(workerData);

const channelSignal = new BroadcastChannel(`Signal`);               //Signal for opening Bots
const botsChannel = new BroadcastChannel(`Bots info`);       //Bots send own id when terminates

let botSettings = dataWorker.botSettings; //Settings for DCA bots
let availableBots = []; //Contain information about free user bots
let activeBots = []; //Contain information about free user bots

//Get message with task
parentPort.on("message", async botTask => {
    try {
        switch (botTask.type) {
            case "ADD":
                console.log("New free bot");

                const availableBot = availableBots.find(data => data.botId === botTask.botId);
                const activeBot = activeBots.find(data => data.botId === botTask.botId);

                if (!availableBot && !activeBot) {
                    availableBots.push({
                        botId: botTask.botId,
                        deposit: botTask.deposit,
                        proxyData: botTask.proxyData
                    });
                }

                console.log(availableBots);
                console.log(activeBots);

                break;

            case "DELETE":
                console.log("Delete dca bot by manager");

                //Bot is availbale and waits signals.
                const availableBotData = availableBots.find(botInfo => botInfo.botId === botTask.botId);
                if (typeof availableBotData !== 'undefined') {
                    const index = availableBots.indexOf(availableBotData);
                    if (index > -1) availableBots.splice(index, 1);

                    parentPort.postMessage({
                        type: "BOT_STATUS_UPDATE",
                        data: {
                            botId: availableBotData.botId,
                            status: "Disabled"
                        }
                    });
                }

                //Bot is active. Send signal for finishing work to the bot.
                const activeBotData = activeBots.find(botInfo => botInfo.botId === botTask.botId);
                console.log('activeBotData', activeBotData);
                if (typeof activeBotData !== 'undefined') {
                    await dcaWorkerManager.deleteWorker(botTask.botId);
                }

                console.log('Available Bots: ', availableBots);
                console.log('Active bots: ', activeBots);

                //Bot manager doen't has bots
                if (activeBots.length === 0 && availableBots.length === 0) {
                    parentPort.postMessage({ type: "TERMINATE" });
                    parentPort.close();
                }

                break;

            case "STOP":
                const botData = dcaWorkerManager.getWorker(botTask.botId);

                //if bot is free and waits signals, then delete
                if (typeof botData === 'undefined') {
                    const bot = availableBots.find(info => info.botId === botTask.botId);
                    const index = availableBots.indexOf(bot);
                    if (index > -1) availableBots.splice(index, 1);

                    parentPort.postMessage({
                        type: "BOT_STATUS_UPDATE",
                        data: {
                            botId: bot.botId,
                            status: "Disabled"
                        }
                    });

                    if (activeBots.length === 0 && availableBots.length === 0) {
                        parentPort.postMessage({ type: "TERMINATE" });
                        parentPort.close();
                    }
                } else { //Stop if bot is active
                    await dcaWorkerManager.stopWorker(botTask.botId);
                }

                break;

            case "RESUME":

                break;

            case "UPDATE_SETTINGS":
                botSettings = JSON.parse(botTask.settings);
                console.log('[Worker] Bot settings updated!');
                break;

            default:
                console.log("Unknown command");
                break;
        }
    } catch (err) {
        console.error(err);
        logger.error(err);
        
        logger.info('Deleting workers during of error')

        try {
            availableBots.length = 0;
            
            for (const activeBot of activeBots) {
                await dcaWorkerManager.deleteWorker(activeBot.botId);
            }
        } catch (err) {
            console.error(err);
            logger.error(err);
        }

        parentPort.postMessage({ type: "TERMINATE" });
        parentPort.close();
    }
});

//Get signal from analyzer and deliver finding free bot
channelSignal.onmessage = async (pair) => {
    try {
        //Find bot with same pair
        const botWithPair = activeBots.find(bot => bot.pair == pair)

        //If pair exists then skip signal
        if (typeof botWithPair !== 'undefined') return

        //No available bots
        const freeBot = availableBots.shift();
        if (typeof freeBot === 'undefined') return;

        logger.info("Start bot with pair: " + pair + ' ' + freeBot.botId);

        activeBots.push({
            pair,
            ...freeBot
        });

        console.log(freeBot.proxyData);

        const settings = {
            pair,
            deposit: freeBot.deposit,
            proxy: freeBot.proxyData,
            ...botSettings
        }
        await dcaWorkerManager.createWorker(freeBot.botId, dataWorker.key, dataWorker.secret, settings);

        //Send update bot status to the main server
        parentPort.postMessage({
            type: "BOT_STATUS_UPDATE",
            data: {
                botId: freeBot.botId,
                status: "Active",
                pair
            }
        });
    } catch (err) {
        logger.error(err);
        console.log(err);
    }
};

//DCA Bots end own work
botsChannel.onmessage = async (data) => {
    try {
        const closeInfo = JSON.parse(data);

        console.log("Bot finished work");
        console.log(closeInfo);
        logger.info("Bot finished work " + JSON.stringify(data));

        //Delete from active bots
        const bot = activeBots.find(info => info.botId === closeInfo.bot.botId);
        const index = activeBots.indexOf(bot);
        if (index > -1) activeBots.splice(index, 1);

        //Check for disabling bot
        switch (closeInfo.type) {
            case 'DELETE':
                parentPort.postMessage({
                    type: "BOT_STATUS_UPDATE",
                    data: {
                        botId: closeInfo.bot.botId,
                        status: "Disabled"
                    }
                });

                //If no active and available bots then terminate Bot manager worker 
                if (activeBots.length === 0 && availableBots.length === 0) {
                    parentPort.postMessage({ type: "TERMINATE" });
                    parentPort.close();
                }
                break;

            case 'ERROR':
                parentPort.postMessage({
                    type: "BOT_STATUS_UPDATE",
                    data: {
                        botId: closeInfo.bot.botId,
                        status: "Error",
                        error: closeInfo.bot.error
                    }
                });

                //If no active and available bots then terminate Bot manager worker 
                if (activeBots.length === 0 && availableBots.length === 0) {
                    parentPort.postMessage({ type: "TERMINATE" });
                    parentPort.close();
                }
                break;
            default:
                availableBots.push({
                    botId: closeInfo.bot.botId,
                    deposit: closeInfo.bot.deposit,
                    proxyData: closeInfo.bot.proxy
                });

                parentPort.postMessage({
                    type: "BOT_STATUS_UPDATE",
                    data: {
                        botId: closeInfo.bot.botId,
                        status: "Wait"
                    }
                });
                break;
        }

        console.log('Available Bots: ', availableBots);
        console.log('Active bots: ', activeBots);
        logger.info('Available Bots: ' + availableBots.length);
        logger.info('Active Bots: ' + activeBots.length);
    } catch (err) {
        logger.error(err);
        console.log(err);
    }
}