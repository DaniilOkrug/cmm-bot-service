const { Worker } = require("worker_threads");
const botModel = require('../models/General/bot.model');

class AnalyzerService {
    createWorker() {
        return new Promise(async (resolve, reject) => {
            const botSettings = (await botModel.find())[0];

            const worker = new Worker("./worker/analyzerWorker/worker.js", {
                workerData: JSON.stringify({
                    ...botSettings.settings.analyzer,
                    algorithm: botSettings.settings.algorithm
                })
            });

            worker.on("message", async (data) => {
                switch (data.type) {
                    default:
                        console.log('[Analyzer] Other data:', data);
                        break;
                }
            });

            worker.on("error", error => {
                console.log(error);
            });

            worker.on("exit", exitCode => {
                console.log('Analyzer exit with code: ' + exitCode);
            })

            botSettings.pairs.forEach(pair => {
                worker.postMessage(pair);
            });

            resolve();
        });
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new AnalyzerService();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton;