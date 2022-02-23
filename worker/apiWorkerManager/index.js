const { Worker } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const dcaBotManager = (require('../dcaWorkerManager/index')).getInstance();

class ApiWorkerManager {
    #workers = [];

    createWorker(key, secret) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker("./worker/apiWorkerManager/worker.js", { workerData: { key, secret } });

                worker.on("message", (data) => {
                    switch (data.type) {
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
        const workerInfo = this.#workers.find(data => data.key == key && data.secret == secret);

        if (typeof workerInfo === 'undefined') return;

        workerInfo.worker.postMessage({ close: true });
    }

    checkAPI(key, secret) {
        return new Promise((resolve, reject) => {
            try {
                let isApiExists = false;

                this.#workers.forEach(workerInfo => {
                    if (workerInfo.key == key && workerInfo.secret == secret) {
                        isApiExists = true;
                    }
                });

                resolve(isApiExists);
            } catch (err) {
                reject(err);
            }
        });
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

module.exports = Singleton;