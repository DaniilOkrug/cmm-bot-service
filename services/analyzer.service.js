const { Worker } = require("worker_threads");
const botModel = require('../models/General/bot.model');

class AnalyzerService {
    #worker;

    createWorker() {
        return new Promise(async (resolve, reject) => {
            const botSettings = (await botModel.find())[0];


            const analyzerSettigs = JSON.parse(JSON.stringify(botSettings.settings.analyzer));
            analyzerSettigs.algorithm = botSettings._doc.settings.algorithm;
            analyzerSettigs.pairs = botSettings._doc.pairs;
            analyzerSettigs.blacklist = botSettings._doc.blacklist;

            const worker = new Worker("./worker/analyzerWorker/worker.js", {
                workerData: JSON.stringify(analyzerSettigs)
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

            this.#worker = worker;

            resolve();
        });
    }

    updateSettings(pairs, settings) {
        try {
            this.#worker.postMessage(JSON.stringify({
                task: 'UPDATE_SETTINGS',
                settings,
                pairs,
            }));
        } catch (err) {
            console.log(err);
        }
    }

    updateBlacklist(blacklist) {
        try {
            this.#worker.postMessage(JSON.stringify({
                task: 'UPDATE_BLACKLIST',
                blacklist
            }));
        } catch (err) {
            console.log(err);
        }
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