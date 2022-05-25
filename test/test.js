const Binance = require('node-binance-api');
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

(async () => {
    console.log(await binance.futuresOpenOrders());
    const positions = (await binance.futuresPositionRisk()).filter((position) => { return position.positionAmt != 0 });
    console.log(positions);
    
    binance.websockets.userFutureData(console.log(), console.log(), async (updateInfo) => {
        console.log(updateInfo.order);
    }, console.log());
})();