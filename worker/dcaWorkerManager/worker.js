const { parentPort, workerData } = require("worker_threads");
const { BroadcastChannel } = require('broadcast-channel');
const { DcaBot } = require('../../utils/dcaBot/dcaBot');
const Analyzer = require("./service/analyzer.service");
const { resolve } = require("path");

console.log(`New DCA Bot`);

const channelOrders = new BroadcastChannel(`${workerData.api} Orders`);

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

            if (typeof bot.orders.takeProfit === 'undefined'){
                channelOrders.close();

                await closeBookTickerSocket();
                
                await bot.cancelGrid(workerData.pair).then(() => {
                    parentPort.postMessage({ type: 'TERMINATE' });
                    parentPort.close();
                });
            }

            break;
        case "DELETE":
            console.log(`[${workerData.pair}] Deleting bot!`);
            await closeBookTickerSocket();

            await bot.cancelGrid(workerData.pair)

            const takeProfit = bot.orders.takeProfit;
            if (typeof takeProfit != 'undefined') {
                await bot.binance.marketSell(workerData.pair, takeProfit.qty);
            }

            parentPort.postMessage({ type: 'TERMINATE' });
            parentPort.close();

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

    status = StatusEnum.stopping;
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
        console.error(err);
        channelOrders.close();
        throw new Error(err);
    }
});

channelOrders.onmessage = async (data) => {
    try {
        const orderTypeCondition = (data.s == workerData.pair && data.X == 'FILLED' && data.e == 'executionReport');
        const statusCondition = (status == StatusEnum.active || status == StatusEnum.stopping);
        if (orderTypeCondition && statusCondition) {
            const orderType = await bot.determineOrder(data);
            switch (orderType) {
                case 'GRID':
                    status = StatusEnum.grid;

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
                    status = StatusEnum.takeprofit;

                    delete bot.orders.takeProfit;

                    await bot.cancelGrid(data.s).then(() => {
                        if (status = StatusEnum.stopping) {
                            parentPort.postMessage({ type: 'TERMINATE' });
                            parentPort.close();
                            return;
                        }
                    });

                    if (bot.options.grid.endCycleDelay != 0) {
                        bot.timers.endCycleTimer.isExecutes = true;
                        status = StatusEnum.endCycleDelay;

                        console.log(`[${workerData.pair}] Start timer for end cycle!`)

                        bot.timers.endCycleTimer.id = createEndCycleTimer(bot);
                    } else {
                        const grid = await bot.calculateGrid();
                        console.log(grid);
                        await bot.startCycle(grid);
                        showBeginPrice = true;

                        status = StatusEnum.active;
                    }
                    break;
                default:
                    break;
            }
        }
    } catch (err) {
        console.error(err);
        channelOrders.close();
        throw new Error(err);
    }
}

(async () => {
    try {
        if (workerData.analyzer.enabled) {
            const analyzer = new Analyzer({
                ...workerData.analyzer,
                pair: workerData.pair,
                algorithm: workerData.algorithm
            });
            
            await analyzer.getSignal().then(async () => {
                console.log('Signal from analyzer');
                bot.pairsInfo = await bot.getPairsData();

                const grid = await bot.calculateGrid();

                await bot.startCycle(grid);

                console.log(grid);
            });
        } else {
            bot.pairsInfo = await bot.getPairsData();

            const grid = await bot.calculateGrid();

            await bot.startCycle(grid);

            console.log(grid);
        }

        setInterval(() => {
            console.log(bot.getUsedWeight());
        }, 60000);
    } catch (err) {
        console.error(err);
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
        bot.timers.newGridTimer.isExecutes = true;

        const grid = await bot.calculateGrid();
        console.log(grid);

        bot.startCycle(grid).then(() => {
            bot.timers.cycleUpTimer.isExecutes = false;
            delete bot.timers.cycleUpTimer.id;

            bot.timers.newGridTimer.isExecutes = false;
            delete bot.timers.newGridTimer.id;

            showBeginPrice = true;

            status = StatusEnum.active;
        });
    }, bot.options.grid.newGridDelay * 60000);
}

function createEndCycleTimer(bot) {
    return setTimeout(async () => {
        const grid = await bot.calculateGrid();
        console.log(grid);

        bot.startCycle(grid).then(() => {
            bot.timers.endCycleTimer.isExecutes = false;
            delete bot.timers.endCycleTimer.id;

            showBeginPrice = true;

            status = StatusEnum.active;
        });
    }, bot.options.grid.endCycleDelay * 60000);
}

function closeBookTickerSocket() {
    return new Promise(async (resolve, reject) => {
        let endpoints = Object.keys(await bot.binance.websockets.subscriptions());

        for (let endpoint in endpoints) {
            if (endpoint == `${workerData.pair.toLowerCase()}@bookTicker`) {
                await bot.binance.websockets.terminate(endpoint);
                break;
            }
        }

        resolve();
    });
}