const { Worker } = require("worker_threads");
const botService = require("./sevices/bot.service");

class ApiWorkerManager {
    #workers = [];

    createWorker(key, secret, botId, deposit) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker("./worker/apiWorkerManager/worker.js", { workerData: { key, secret } });

                worker.on("message", async (data) => {
                    switch (data.type) {
                        case "BOT_CONFIG":
                            const botConfiguration = await botService.getBotConfiguration(data.pair, key, secret);

                            if (typeof botConfiguration === 'undefined') { return; }

                            worker.postMessage({
                                type: "NEW_BOT",
                                ...botConfiguration
                            });
                            break;
                        case "TERMINATE":
                            worker.terminate();
                            break;
                        default:
                            console.log(data);
                            break;
                    }
                });

                worker.on("error", error => {
                    console.log(error);
                });
                worker.on("exit", exitCode => {
                    console.log("Api Worker exit with code: " + exitCode);
                })

                this.#workers.push({
                    worker,
                    key,
                    secret
                });

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    deleteWorker(key, secret) {
        return new Promise((resolve, reject) => {
            try {
                const workerInfo = this.#workers.find(data => data.key == key && data.secret == secret);

                if (typeof workerInfo === 'undefined') reject(new Error("API Listener worker undefined"));

                workerInfo.worker.postMessage({ close: true });

                const workerIndex = this.#workers.indexOf(workerInfo);
                if (workerIndex > -1) {
                    this.#workers.splice(workerIndex, 1);
                }

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    checkAPI(key, secret) {
        const worker = this.#workers.find(info => info.key == key && info.secret == secret);
        return typeof worker !== "undefined"
    }

    getChannel(key, secret) {
        return (this.#workers.find(data => data.key == key && data.secret == secret)).channel;
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new ApiWorkerManager();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton.getInstance();