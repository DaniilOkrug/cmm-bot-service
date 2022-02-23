const { DcaBot } = require('../../utils/dcaBot/dcaBot');
const Analyzer = require('./analyzer.service');

const StatusEnum = {
    preparing: "PREPARE", // Bot prepares for the cycle
    active: "ACTIVE", // Bot in normal active mode
    takeprofit: "TAKEPROFIT", // Bot exeutes actions related to the TP
    grid: "GRID", // Bot executes code related to the GRID order
    newGridDelay: "NEWGRIDDELAY",
    endCycleDelay: "ENDCYCLEDELAY",
    stopping: "STOPPING", // Bot working but wait finishing cycle for terminating bot
    disabled: "DISABLED"
}

class BotService {
    #dcaBot;
    #analyzer;
    #status = StatusEnum.disabled;

    constructor(options) {
        this.#dcaBot =  new DcaBot(options);

        if (options.analyzer.enabled) {
            this.#analyzer = new Analyzer(options.analyzer);
        }

        this.#status = StatusEnum.preparing;
    }

    get dcaBot() {
        return this.#dcaBot;
    }

    processBookTicker(data) {
        const bot = this.#dcaBot;
        const pair = this.#dcaBot.options.pair;

        const cycleUpTimerId = bot.timers.cycleUpTimer.id;

        if (typeof cycleUpTimerId === 'undefined') {
            const orders = bot.orders;

            if (typeof orders.takeProfit != 'undefined') {

                if (!isTPdefined) console.log(`[${pair}] Takeprofit exists`);

                isTPdefined = true;
                return;
            }

            isTPdefined = false;

            if (this.#status != StatusEnum.active) {
                if (oldStatus != this.#status) console.log(`[${pair}] Status ${this.#status}`);
                oldStatus = this.#status;
                return;
            }

            const closestOrder = await bot.getClosestOrder();
            if (typeof closestOrder === 'undefined') {
                console.log(`[${pair}] Closest order undefined!`);
                return;
            }

            //Calculate price when need to replace orders because the price has 
            //moved too far from them
            const followMultiplier = (bot.options.grid.priceFollow / 100) + 1;
            const followBeginPrice = closestOrder.price * followMultiplier;

            if (showBeginPrice) {
                console.log(`[${pair}] Ask ${data.bestAsk} target price: ${followBeginPrice}`);
                showBeginPrice = false;
            }

            if (bot.options.algorithm == 'long' && data.bestAsk >= followBeginPrice) {
                if (bot.options.grid.priceFollowDelay == 0) {
                    console.log(`[${pair}] Cancel grid without timer. Price too far!`);

                    await bot.cancelGrid(data.symbol);
                    const grid = await bot.calculateGrid();

                    console.log(grid);

                    await bot.startCycle(grid);
                    showBeginPrice = true;
                } else {
                    console.log(`[${pair}] Start timer for replacing grid!`)

                    bot.timers.cycleUpTimer.id = createCycleUpTimer(bot);
                }
            }
        } else {
            if (!bot.timers.cycleUpTimer.isExecutes) {
                const closestOrder = await bot.getClosestOrder();
                const followMultiplier = (bot.options.grid.priceFollow / 100) + 1;
                const followBeginPrice = closestOrder.price * followMultiplier;

                if (bot.options.algorithm == 'long' && data.bestAsk < followBeginPrice) {
                    console.log(`[${pair}] Cancel timer. Price returned to the orders!`);

                    clearTimeout(bot.timers.cycleUpTimer.id);
                    delete bot.timers.cycleUpTimer.id;
                }
            }
        }
    }
}

module.exports = new Bot();