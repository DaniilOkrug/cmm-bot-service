const { parentPort, workerData } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const Analyzer = require('./analyzer');

const analyzer = new Analyzer(workerData);
const channelSignal = new BroadcastChannel(`Signal`);

const intervals = {}; // pair: intervalID

let intervalTime = calculateIntervalTime(workerData.interval)

parentPort.on('message', async (pair) => {
    // console.log('[Analyzer] getting signal');
    const signal = await analyzer.getSignal(pair);

    if (signal) {
        channelSignal.postMessage(pair);
    }

    const intervalId = setInterval(async () => {
        // console.log('[Analyzer] getting signal');
        const signal = await analyzer.getSignal(pair);

        if (signal) {
            channelSignal.postMessage(pair);
        }
    }, intervalTime);

    intervals[pair] = intervalId;
});

parentPort.on('clearPairs', () => {
    clearActivePairs();
});

function clearActivePairs() {
    return new Promise((resolve, reject) => {
        const activePairs = Object.keys(intervals);

        if (activePairs.length === 0) return

        for (pair in activePairs) {
            const intevalID = activePairs.pair;
            clearInterval(intevalID);
            delete activePairs.pair;
        }

        resolve();
    });
}

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