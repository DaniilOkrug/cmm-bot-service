const { Worker } = require("worker_threads");

class DcaWorkerManager {
    #workers = [];

    createWorker(botId, key, secret, botSettings) {
        return new Promise((resolve, reject) => {
            
            const worker = new Worker("./worker/dcaWorkerManager/worker.js", {
                workerData: {
                    ...botSettings,
                    api: key,
                    secret
                }
            });

            worker.on("message", (data) => {
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
            })

            this.#workers.push({
                botId,
                key,
                secret,
                worker,
            });

            resolve();
        });
    }

    deleteWorker(botId) {
        return new Promise((resolve, reject) => {
            const workerInfo = this.#workers.find(data => data.botId == botId);
            if (typeof workerInfo === 'undefined') return;

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
            if (typeof workerInfo === 'undefined') return;
            
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

module.exports = Singleton;