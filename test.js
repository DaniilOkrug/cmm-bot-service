require('dotenv').config();
const Binance = require('node-binance-api');
const { connectDB } = require('./loaders/connectionDB.loader');
const ProxyModel = require('./models/General/proxy.model');
const proxyService = (require('./services/proxy.service'));

const binance = new Binance().options({
    APIKEY: 'S1gQTrvXF66fiXh4oZNyR1lYsOcsXKcng1AJjJ001vIVnu5X4vN0N7QHtzjjwJHX',
    APISECRET: 'q3vkxft2F8cmXpF5XvaQB2igfwCL6Evh6DJgYjN8lURLzVxX0tfDk1XsjvS2Ogjf',
    proxy: {
        host: '31.222.250.154',
        port: 3056,
        auth: {
            username: 'user83029',
            password: '6njvae'
        }
    }
});

const proxies = [
    {
        address: '31.222.250.154',
        portHTTP: 3056,
        portSOCKS: 13056,
        username: 'user83029',
        password: '6njvae'
    },
    {
        address: '103.146.97.181',
        portHTTP: 3056,
        portSOCKS: 13056,
        username: 'user83029',
        password: '6njvae'
    },
    {
        address: '31.222.250.39',
        portHTTP: 3056,
        portSOCKS: 13056,
        username: 'user83029',
        password: '6njvae'
    }
];

(async () => {
    console.log(await binance.futuresOpenOrders());
    const positions = (await binance.futuresPositionRisk()).filter((position) => { return position.positionAmt != 0 });
    console.log(positions);
    
    binance.websockets.userFutureData(console.log(), console.log(), async (updateInfo) => {
        console.log(updateInfo.order);
    }, console.log());
});


(async () => {
    await connectDB();

    proxies.forEach(async proxy => {
        console.log(proxy);
        await ProxyModel.create({
            address: proxy.address,
            portHTTP: proxy.portHTTP,
            portSOCKS: proxy.portSOCKS,
            username: proxy.username,
            password: proxy.password
        });
    })
});

(async () => {
    await connectDB();
    await proxyService.loadProxies();

    proxyService.job.addBotProxy();
})();