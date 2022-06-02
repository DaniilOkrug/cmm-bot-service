const { Worker } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');

const socketService = require("../../services/socket.service");
const proxyService = (require("../../services/proxy.service")).getInstance();

const { logger } = require("../../utils/logger/logger");

class BotManager {
    #workers = [];
    #settingsChannel;

    createWorker(key, secret, botSettings) {
        return new Promise((resolve, reject) => {
            try {
                console.log("Create new bot manager");

                const worker = new Worker("./worker/botManager/worker.js", {
                    workerData: JSON.stringify({
                        key,
                        secret,
                        botSettings,
                    })
                });

                worker.on("message", async (task) => {
                    switch (task.type) {
                        case "TERMINATE":
                            worker.terminate();
                            break;
                        case "BOT_STATUS_UPDATE":
                            console.log("BOT_STATUS_UPDATE", task.data);

                            if (task.data.status === 'Disabled' || task.data.status === 'Error') { 
                                proxyService.job.deleteBotProxy(task.data.botId);
                            }

                            socketService.sendBotUpdate(task.data);
                            break;
                        default:
                            break;
                    }
                });

                worker.on("error", error => {
                    console.log(error);
                });
                worker.on("exit", exitCode => {
                    console.log("Bot Manager Worker exit with code: " + exitCode);

                    //Delete bot manager worker from workers list
                    const workerData = this.#workers.find(info => info.key === key && info.secret == secret);
                    const index = this.#workers.indexOf(workerData);
                    if (index > -1) this.#workers.splice(index, 1);
                })

                this.#workers.push({
                    worker,
                    key,
                    secret
                });

                resolve(worker);
            } catch (err) {
                console.error(err);
                logger.error(err);
                reject(err);
            }
        });
    }

    addBot(key, secret, botId, deposit, proxyData) {
        return new Promise((resolve, reject) => {
            try {
                const workerInfo = this.#workers.find(workerInfo => key === workerInfo.key && secret === workerInfo.secret);

                workerInfo.worker.postMessage({
                    botId,
                    deposit,
                    proxyData,
                    type: "ADD"
                });

                resolve()
            } catch (err) {
                console.error(err);
                logger.error(err);
                reject(err);
            }
        });
    }

    deleteBot(key, secret, botId) {
        return new Promise((resolve, reject) => {
            try {
                const workerInfo = this.#workers.find(workerInfo => key === workerInfo.key && secret === workerInfo.secret);

                if (typeof workerInfo === 'undefined') return resolve();

                workerInfo.worker.postMessage({
                    botId,
                    type: "DELETE"
                });

                resolve()
            } catch (err) {
                console.error(err);
                logger.error(err);
                reject(err);
            }
        });
    }

    stopBot(key, secret, botId) {
        return new Promise((resolve, reject) => {
            try {
                const workerInfo = this.#workers.find(workerInfo => key === workerInfo.key && secret === workerInfo.secret);

                if (typeof workerInfo === 'undefined') return resolve('Disabled');

                workerInfo.worker.postMessage({
                    botId,
                    type: "STOP"
                });

                resolve('Stopping');
            } catch (err) {
                console.error(err);
                logger.error(err);
                reject(err);
            }
        });
    }

    updateBotSettings(botSettings) {
        return new Promise((resolve, reject) => {
            try {
                console.log("Update settings");
                this.#workers.forEach((data) => {
                    data.worker.postMessage({
                        type: 'UPDATE_SETTINGS',
                        settings: JSON.stringify(botSettings)
                    });
                });
                resolve();
            } catch (err) {
                console.error(err);
                logger.error(err);
                reject(err);
            }
        });
    }

    isActive(key, secret) {
        const worker = this.#workers.find(workerInfo => key === workerInfo.key && secret === workerInfo.secret);
        return typeof worker !== "undefined"
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new BotManager();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton.getInstance();