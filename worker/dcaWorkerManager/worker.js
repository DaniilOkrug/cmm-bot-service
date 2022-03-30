const { parentPort, workerData } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const { DcaBot } = require('../../utils/dcaBot/dcaBot');

console.log(`New DCA Bot`);

const channelOrders = new BroadcastChannel(`${workerData.api} Orders`);
const botsChannel = new BroadcastChannel(`Bots info`);

const StatusEnum = {
    preparing: "PREPARE", // Bot prepares for the cycle
    active: "ACTIVE", // Bot in normal active mode
    takeprofit: "TAKEPROFIT", // Bot exeutes actions related to the TP
    grid: "GRID", // Bot executes code related to the GRID order
    newGridDelay: "NEWGRIDDELAY",
    endCycleDelay: "ENDCYCLEDELAY",
    stopping: "STOPPING" // Bot working but wait finishing cycle for terminating bot
}

let status = StatusEnum.active;

const bot = new DcaBot({
    ...workerData,
    verbose: true
});


parentPort.on('message', async data => {
    switch (data.type) {
        case "STOP":
            console.log(`[${workerData.pair}] Stopping bot!`);

            status = StatusEnum.stopping;

            if (typeof bot.orders.takeProfit === 'undefined') {
                channelOrders.close();

                await closeBookTickerSocket();

                await bot.cancelGrid(workerData.pair);

                botsChannel.postMessage(JSON.stringify({
                    type: "DELETE",
                    bot: {
                        botId: workerData.botId,
                        deposit: workerData.deposit
                    }
                })).then(() => {
                    parentPort.postMessage({ type: 'TERMINATE' });
                    parentPort.close();
                });
            }

            break;
        case "DELETE":
            const deletePromise = new Promise(async (resolve, reject) => {
                try {
                    console.log(`[${workerData.pair}] Deleting bot!`);
                    await closeBookTickerSocket();

                    const takeProfit = bot.orders.takeProfit;
                    if (typeof takeProfit != 'undefined') {
                        await bot.cancelTakeProfit(workerData.pair);

                        await bot.binance.marketSell(workerData.pair, takeProfit.qty);
                    }

                    await bot.cancelGrid(workerData.pair);

                    await botsChannel.postMessage(JSON.stringify({
                        type: "DELETE",
                        bot: {
                            botId: workerData.botId,
                            deposit: workerData.deposit
                        }
                    }));

                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            deletePromise
                .catch(err => console.log(err))
                .finally(() => {
                    parentPort.postMessage({ type: 'TERMINATE' });
                    parentPort.close();
                });
            break;
        default:
            break;
    }
});

parentPort.on('status', () => {
    parentPort.postMessage({
        type: "STATUS",
        status
    });
});

parentPort.on('stop', () => {
    console.log('Stopping bot!');

    status = StatusEnum.j;
});

// debug
let showBeginPrice = true
let oldStatus = status;
let isTPdefined = false;
//

bot.binance.websockets.bookTickers(workerData.pair, async (data) => {
    try {
        if (status == StatusEnum.stopping && typeof bot.orders.takeProfit === 'undefined') return;

        const cycleUpTimerId = bot.timers.cycleUpTimer.id;
        if (typeof cycleUpTimerId === 'undefined') {
            const orders = bot.orders;

            if (typeof orders.takeProfit != 'undefined') {

                if (!isTPdefined) console.log(`[${workerData.pair}] Takeprofit exists`);

                isTPdefined = true;
                return;
            }

            isTPdefined = false;

            if (status != StatusEnum.active) {
                if (oldStatus != status) console.log(`[${workerData.pair}] Status ${status}`);
                oldStatus = status;
                return;
            }

            const closestOrder = await bot.getClosestOrder();
            if (typeof closestOrder === 'undefined') {
                console.log(`[${workerData.pair}] Closest order undefined!`);
                return;
            }

            //Calculate price when need to replace orders because the price has 
            //moved too far from them
            const followMultiplier = (bot.options.grid.priceFollow / 100) + 1;
            const followBeginPrice = closestOrder.price * followMultiplier;

            if (showBeginPrice) {
                console.log(`[${workerData.pair}] Ask ${data.bestAsk} target price: ${followBeginPrice}`);
                showBeginPrice = false;
            }

            if (bot.options.algorithm == 'long' && data.bestAsk >= followBeginPrice) {
                if (bot.options.grid.priceFollowDelay == 0) {
                    console.log(`[${workerData.pair}] Cancel grid without timer. Price too far!`);

                    await bot.cancelGrid(data.symbol);
                    const grid = await bot.calculateGrid();

                    console.log(grid);

                    await bot.startCycle(grid);
                    showBeginPrice = true;
                } else {
                    console.log(`[${workerData.pair}] Start timer for replacing grid!`)

                    bot.timers.cycleUpTimer.id = createCycleUpTimer(bot);
                }
            }
        } else {
            if (!bot.timers.cycleUpTimer.isExecutes) {
                const closestOrder = await bot.getClosestOrder();
                const followMultiplier = (bot.options.grid.priceFollow / 100) + 1;
                const followBeginPrice = closestOrder.price * followMultiplier;

                if (bot.options.algorithm == 'long' && data.bestAsk < followBeginPrice) {
                    console.log(`[${workerData.pair}] Cancel timer. Price returned to the orders!`);

                    clearTimeout(bot.timers.cycleUpTimer.id);
                    delete bot.timers.cycleUpTimer.id;
                }
            }
        }
    } catch (err) {
        if (err.body) {
            console.log(Object.keys(err));
        } else {
            console.error(err);
        }

        channelOrders.close();

        throw new Error(err);
    }
});

channelOrders.onmessage = async (data) => {
    try {
        const orderTypeCondition = (data.s == workerData.pair && data.X == 'FILLED' && data.e == 'executionReport');
        if (orderTypeCondition) {
            const orderType = await bot.determineOrder(data);
            switch (orderType) {
                case 'GRID':
                    if (status != StatusEnum.stopping) {
                        status = StatusEnum.grid;
                    }

                    // Reset timer if exists
                    const cycleUpTimerId = bot.timers.cycleUpTimer.id;
                    if (typeof cycleUpTimerId != 'undefined') {
                        clearTimeout(cycleUpTimerId);
                        delete bot.timers.cycleUpTimer.id;
                        bot.timers.cycleUpTimer.isExecutes = false;
                    }


                    for (let i = 0; i < bot.orders.grid.length; i++) {
                        const order = bot.orders.grid[i];

                        if (order.orderId == data.i) { 
                            bot.orders.grid[i].status = data.X;
                            break;
                        }
                    }

                    const takeprofit = await bot.createTakeProfit(data.s);
                    console.log(takeprofit);

                    status = StatusEnum.active;
                    break;
                case 'TAKEPROFIT':
                    if (status != StatusEnum.stopping) {
                        status = StatusEnum.takeprofit;
                    }

                    delete bot.orders.takeProfit;

                    await bot.cancelGrid(data.s);

                    await botsChannel.postMessage(JSON.stringify({
                        type: "READY",
                        bot: {
                            botId: workerData.botId,
                            deposit: workerData.deposit
                        }
                    })).then(() => {
                        parentPort.postMessage({ type: 'TERMINATE' });
                        parentPort.close();
                    });
                    break;
                default:
                    console.log(`[${workerData.pair}] Other orderType`);
                    break;
            }
        }
    } catch (err) {
        console.error(err);
        channelOrders.close();
        console.log(Object.keys(err));
        throw new Error(err);
    }
}

(async () => {
    try {
        status = StatusEnum.preparing;

        bot.pairsInfo = await bot.getPairsData();

        const grid = await bot.calculateGrid();

        await bot.startCycle(grid);

        console.log(grid);

        status = StatusEnum.active;

        setInterval(() => {
            const weigth = bot.getUsedWeight(); 
            if (weigth > 900) {
                console.log("Used API Weight: " + weigth);
            }
        }, 60000);
    } catch (err) {
        if (err.body) {
            console.log(Object.keys(err));
        } else {
            console.error(err);
        }
    }
})();

function createCycleUpTimer(bot) {
    return setTimeout(async () => {
        bot.timers.cycleUpTimer.isExecutes = true;
        console.log(`[${workerData.pair}] Cancel grid. Price too far!`);

        await bot.cancelGrid(workerData.pair);

        if (bot.options.grid.newGridDelay != 0) {
            status = StatusEnum.newGridDelay;

            console.log(`[${workerData.pair}] Start timer for new grid placing!`)

            bot.timers.newGridTimer.id = createNewGridTimer(bot);
        } else {
            const grid = await bot.calculateGrid();
            console.log(grid);

            bot.startCycle(grid).then(() => {
                bot.timers.cycleUpTimer.isExecutes = false;
                delete bot.timers.cycleUpTimer.id;

                showBeginPrice = true;
            });
        }
    }, bot.options.grid.priceFollowDelay * 60000);
}

function createNewGridTimer(bot) {
    return setTimeout(async () => {
        try {
            bot.timers.newGridTimer.isExecutes = true;

            const grid = await bot.calculateGrid();
            console.log(grid);

            await bot.startCycle(grid);

            bot.timers.cycleUpTimer.isExecutes = false;
            delete bot.timers.cycleUpTimer.id;

            bot.timers.newGridTimer.isExecutes = false;
            delete bot.timers.newGridTimer.id;

            showBeginPrice = true;

            status = StatusEnum.active;
        } catch (err) {
            console.error(err);
        }
    }, bot.options.grid.newGridDelay * 60000);
}

function createEndCycleTimer(bot) {
    return setTimeout(async () => {
        try {
            bot.timers.endCycleTimer.isExecutes = true;

            parentPort.postMessage({ type: 'TERMINATE' });
            parentPort.close();
        } catch (err) {
            console.error(err);
        }
    }, bot.options.grid.endCycleDelay * 60000);
}

function closeBookTickerSocket() {
    return new Promise(async (resolve, reject) => {
        try {
            let endpoints = Object.keys(await bot.binance.websockets.subscriptions());

            for (let endpoint in endpoints) {
                if (endpoint == `${workerData.pair.toLowerCase()}@bookTicker`) {
                    await bot.binance.websockets.terminate(endpoint);
                    break;
                }
            }

            resolve();
        } catch (err) {
            reject(err);
        }
    });
}