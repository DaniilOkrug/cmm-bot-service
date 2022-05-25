const { Worker } = require("worker_threads");

class DcaWorkerManager {
    #workers = [];

    /**
     * Creates dca worker
     * @param {*} botId id of the user bot
     * @param {string} key api key
     * @param {string} secret api secret
     * @param {*} botSettings 
     * @returns 
     */
    createWorker(botId, key, secret, botSettings) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker("./worker/dcaWorkerManager/worker.js", {
                    workerData: {
                        botId,
                        secret,
                        api: key,
                        ...botSettings
                    }
                });

                worker.on("message", async (data) => {
                    switch (data.type) {
                        case 'TERMINATE':
                            worker.terminate();
                            break;
                        default:
                            break;
                    }
                });

                worker.on("error", error => {
                    console.log(error);
                });

                worker.on("exit", exitCode => {
                    console.log('DCA bot exit with code: ' + exitCode);
                });

                this.#workers.push({
                    botId,
                    key,
                    secret,
                    worker,
                });

                resolve(worker);
            } catch (err) {
                console.log(err);
            }
        });
    }

    deleteWorker(botId) {
        return new Promise((resolve, reject) => {
            const workerInfo = this.#workers.find(data => data.botId === botId);

            if (typeof workerInfo === 'undefined') return resolve();

            workerInfo.worker.postMessage({
                type: 'DELETE'
            });

            const workerIndex = this.#workers.indexOf(workerInfo);
            if (workerIndex > -1) {
                this.#workers.splice(workerIndex, 1);
            }

            resolve();
        });
    }

    stopWorker(botId) {
        return new Promise((resolve, reject) => {
            const workerInfo = this.#workers.find(data => data.botId == botId);
            if (typeof workerInfo === 'undefined') return resolve();

            workerInfo.worker.postMessage({
                type: 'STOP'
            });

            const workerIndex = this.#workers.indexOf(workerInfo);
            if (workerIndex > -1) {
                this.#workers.splice(workerIndex, 1);
            }

            resolve();
        });
    }

    getWorkers(key, secret) {
        return this.#workers.filter(data => data.key == key && data.secret == secret);
    }

    getWorker(botId) {
        return this.#workers.find(data => data.botId == botId);
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new DcaWorkerManager();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton.getInstance();