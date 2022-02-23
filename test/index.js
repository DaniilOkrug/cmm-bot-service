const Binance = require('node-binance-api');
const binance = new Binance().options({
    APIKEY: '5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ',
    APISECRET: 'iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A',
    reconnect: true
});

(async () => {
    // Intervals: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
    binance.candlesticks("BNBBTC", "5m", (error, ticks, symbol) => {
        console.info("candlesticks()", ticks);
        let last_tick = ticks[ticks.length - 1];
        console.log(last_tick);
        let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
        // console.log(time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored);
    }, { limit: 1000 });
})();