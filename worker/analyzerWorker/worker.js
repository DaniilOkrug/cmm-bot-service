const { parentPort, workerData } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const Analyzer = require('./analyzer');
const { logger } = require("../../utils/logger/logger");

const settings = JSON.parse(workerData);
console.log(settings);
const analyzer = new Analyzer(settings);
const channelSignal = new BroadcastChannel(`Signal`);

let intervalId;
let intervalTime = calculateIntervalTime(settings.interval)
let pairs = [...settings.pairs];
let blacklist = [...settings.blacklist];

parentPort.on('message', async (jobString) => {
    try {
        const job = JSON.parse(jobString);

        switch (job.task) {
            case 'UPDATE_SETTINGS':
                pairs = job.pairs;
                analyzer.options = job.settings;
                console.log('[Analyzer] Settings updated!');
                break;

            case 'UPDATE_BLACKLIST':
                blacklist = job.blacklist;
                console.log('[Analyzer] Blacklist updated!');
                break;

            default:
                break;
        }
    } catch (err) {
        console.log(err);
        logger.error(err);
    }
});

(async () => {
    for (const pair of pairs.filter(pair => !blacklist.includes(pair))) {
        const signal = await analyzer.getSignal(pair);

        if (signal) {
            channelSignal.postMessage(pair);
        }
    }

    intervalId = setInterval(async () => {
        const availablePairs = pairs.filter(pair => !blacklist.includes(pair));
        for (const pair of availablePairs) {
            const signal = await analyzer.getSignal(pair);

            if (signal) {
                channelSignal.postMessage(pair);
            }
        }
    }, intervalTime);
})();

function calculateIntervalTime(interval) {
    const intervalToken = (interval.match(/(\d+)/))[0];
    const intervalTypeToken = interval[interval.length - 1];

    switch (intervalTypeToken) {
        case 'm':
            return Number(intervalToken) * 60 * 1000;
        case 'h':
            return Number(intervalToken) * 60 * 60 * 1000;
        default:
            throw new Error('[Analyzer] Wrong Interval!');
    }
}