const { parentPort, workerData } = require("worker_threads");
const Binance = require('node-binance-api');
const { BroadcastChannel } = require('broadcast-channel');

const binance = new Binance().options({
    APIKEY: workerData.key,
    APISECRET: workerData.secret,
    reconnect: true,
    keepAlive: true,
    useServerTime: true,
    recvWindow: 5000
});

console.log(`New API Listener`);

const channelOrders = new BroadcastChannel(`${workerData.key} Orders`);

parentPort.on("message", async data => {
    if (data.close) {
        channelOrders.close();

        let endpoints = await binance.websockets.subscriptions();
        for (let endpoint in endpoints) {
            await binance.websockets.terminate(endpoint);
        }

        setInterval(async () => {
            if (Object.keys(await binance.websockets.subscriptions()).length == 0) {
                parentPort.postMessage({ type: 'TERMINATE' });
                parentPort.close();
            }
        }, 200);
    }
});

(async () => {
    try {
        openWebsockets();
    } catch (err) {
        console.log(err);
    }
})();

function openWebsockets() {
    try {
        binance.websockets.userData(
            data => channelOrders.postMessage(data),
            data => {
                console.log('exec');
                console.log();
            },
            data => console.log(data),
            data => console.log(data));
    } catch (err) {
        console.log(err);
        openWebsockets();
    }
}