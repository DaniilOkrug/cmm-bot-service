const { GridBot } = require("./gridBot");


const bot = new GridBot({
    api: '5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ',
    secret: 'iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A',
    deposit: 100,
    pairs: ['XRPBUSD'],
    algorithm: 'long',
    grid: {
        size: 3,
        ordersNumber: 3,
        martingeil: 5,
        indentFirstOrder: 0.05,
        priceFollow: 1,
        priceFollowDelay: 1
    }
});

(async () => {
    // await bot.run();

    bot.tickersInfo();

    console.log(bot.pairsInfo[0]);
})();