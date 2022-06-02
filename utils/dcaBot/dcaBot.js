const Binance = require('node-binance-api');

const defaultOptions = {
    deposit: 0,
    pair: '',
    algorithm: 'long',
    verbose: true,
    analyzer: {
        enabled: false,
        period: '1h',
        interval: '1m',
        priceChange: 0,
        minPriceChangeNumber: 0,
        minVolume: 0,
    },
    grid: {
        size: 5,
        ordersNumber: 20,
        distribution: 'linear', //linear/logarithmic
        martingeil: 3,
        indentFirstOrder: 1,
        profit: 0.5,
        priceFollow: 1.5,
        priceFollowDelay: 1, //minutes
        newGridDelay: 0,
        endCycleDelay: 0,
        logFactor: 1 // for logarithmic distribution
    },
    mongodb: {
        enabled: false,
        connectionLink: ''
    }
}

class DcaBot {
    #options = defaultOptions;
    binance; //Binance account for bot usage
    orders = {};
    pairsInfo = [];
    timers = {
        cycleUpTimer: {
            isExecutes: false
            //id
        },
        endCycleTimer: {
            isExecutes: false
            //id
        },
        newGridTimer: {
            isExecutes: false
            //id
        }
    }

    constructor(options) {
        try {
            if (typeof options === 'undefined') throw new Error('Wrong options');
            this.#options = options;

            if (typeof options.api === 'undefined') throw new Error('Wrong api key');
            if (typeof options.secret === 'undefined') throw new Error('Wrong secret key');
            if (typeof options.deposit != 'number' || options.deposit <= 0) throw new Error('Wrong deposit');

            //Validate options for undefined
            const generalOptions = Object.keys(defaultOptions);
            generalOptions.forEach(generalOption => {
                if (typeof this.#options[generalOption] === 'undefined') {
                    this.#options[generalOption] = {};
                }

                const detailedOptions = Object.keys(defaultOptions[generalOption]);
                detailedOptions.forEach(detailedOption => {
                    if (typeof this.#options[generalOption][detailedOption] === 'undefined') {
                        this.#options[generalOption][detailedOption] = defaultOptions[generalOption][detailedOption];
                    }
                });
            });

            //Run grid bot
            this.binance = new Binance().options({
                APIKEY: this.#options.api,
                APISECRET: this.#options.secret,
                useServerTime: true,
                recvWindow: 60000,
                proxy: {
                    host: this.#options.proxy.address,
                    port: this.#options.proxy.portHTTP,
                    auth: {
                        username: this.#options.proxy.username,
                        password: this.#options.proxy.password
                    }
                }
            });
        } catch (err) {
            console.error(err);
        }
    }

    get options() {
        return this.#options;
    }

    getUsedWeight() {
        return this.binance.usedWeight();
    }

    getClosestOrder() {
        return new Promise((resolve, reject) => {
            try {
                if (typeof this.orders.takeProfit != 'undefined') resolve();
                if (typeof this.orders.grid === 'undefined') resolve();
                if (this.orders.grid.length == 0) resolve();

                const firstOrder = this.orders.grid[0];
                if (firstOrder.status == 'NEW') {
                    resolve(firstOrder);
                } else {
                    reject(new Error(`[${this.options.pair}] The first order is filled and there is no take profit!`))
                }
            } catch (err) {
                reject(new Error('getClosestOrder | ' + err));
            }
        });
    }

    getPairsData() {
        return new Promise((resolve, reject) => {
            try {
                if (this.#options.verbose) console.log(`[${this.options.pair}] Get pairs info from Binance!`);

                this.binance.exchangeInfo((err, data) => {
                    try {
                        if (err) throw err

                        data.symbols.forEach(info => {
                            if (this.#options.pair == info.symbol) {
                                resolve(info);
                            }
                        });
                    } catch (err) {
                        reject(err);
                    }
                });
            } catch (err) {
                reject(new Error('getPairsData | ' + err));
            }
        });
    }

    calculateGrid() {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.#options.verbose) console.log(`[${this.options.pair}] Calculating grid!`);

                let grid = [];
                const pair = this.#options.pair;
                const gridPrices = await this.getGridPrices(pair);
                const gridVolumes = await this.getGridVolumes(pair, gridPrices);

                grid.push({
                    symbol: pair,
                    prices: gridPrices,
                    volumes: gridVolumes
                });

                resolve(grid);
            } catch (err) {
                reject(new Error(err));
            }
        });
    }

    startCycle(grids) {
        return new Promise((resolve, reject) => {
            try {
                grids.forEach(async (grid, index, array) => {
                    console.log(`Start cycle for ${grid.symbol}`);
                    for (let i = 0; i < grid.prices.length; i++) {
                        const price = grid.prices[i];
                        const volume = grid.volumes[i];
                        const binanceResponse = await this.binance.order('BUY', grid.symbol, volume, price, {
                            type: 'LIMIT'
                        });

                        console.log(binanceResponse);

                        if (typeof this.orders.grid === 'undefined') {
                            this.orders = {
                                grid: []
                            }

                            this.orders.grid = [{
                                orderId: binanceResponse.orderId,
                                side: binanceResponse.side,
                                status: binanceResponse.status,
                                price: +binanceResponse.price,
                                qty: +binanceResponse.origQty

                            }];
                        } else {
                            this.orders.grid.push({
                                orderId: binanceResponse.orderId,
                                side: binanceResponse.side,
                                status: binanceResponse.status,
                                price: +binanceResponse.price,
                                qty: +binanceResponse.origQty

                            });
                        }
                        // console.log(this.#orders.grid);
                    }

                    if (index === array.length - 1) resolve();
                })
            } catch (err) {
                reject(new Error('startCycle | ' + err));
            }
        });
    }

    getGridVolumes(symbol, prices) {
        return new Promise(async (resolve, reject) => {
            try {
                let martingeilSum = 1;

                const martingeilMultiplier = 1 + (this.#options.grid.martingeil / 100);
                for (let i = 0; i < this.#options.grid.ordersNumber; i++) {
                    martingeilSum += Math.pow(martingeilMultiplier, i);
                }

                const firstOrderSize = await this.filterNotionalValue(symbol, this.#options.deposit / martingeilSum); //in QuoteAsset
                let volumes = [await this.filterLotSize(symbol, firstOrderSize / prices[0])];

                let orderSize = firstOrderSize;
                for (let i = 1; i < prices.length; i++) {
                    orderSize = orderSize * martingeilMultiplier;
                    volumes.push(await this.filterLotSize(symbol, orderSize / prices[i]));
                }

                resolve(volumes);
            } catch (err) {
                reject(new Error(err));
            }
        });
    }

    getGridPrices(symbol) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.#options.verbose) console.log(`[${this.options.pair}] Calculating level prices for ${symbol}!`);

                const symbolPrice = (await this.binance.prices(symbol))[symbol];

                const indentMultiplier = this.#options.algorithm === 'long' ? 1 - this.#options.grid.indentFirstOrder / 100
                    : 1 + this.#options.grid.indentFirstOrder / 100;

                const firstOrderPrice = symbolPrice * indentMultiplier;

                let gridPrices = [await this.filterPrice(firstOrderPrice)];

                if (this.#options.grid.ordersNumber === 1) return resolve(gridPrices);

                let step = 0.0;
                let lastOrderPrice;
                if (this.#options.algorithm === 'long') {
                    lastOrderPrice = firstOrderPrice * (1 - this.#options.grid.size / 100);
                    step = (firstOrderPrice - lastOrderPrice) / this.#options.grid.ordersNumber;
                } else {
                    lastOrderPrice = firstOrderPrice * (1 + this.#options.grid.size / 100);
                    step = (lastOrderPrice - firstOrderPrice) / this.#options.grid.ordersNumber;
                }

                if (this.#options.grid.ordersNumber === 2) {
                    gridPrices.push(await this.filterPrice(lastOrderPrice));
                    return resolve(gridPrices);
                }

                switch (this.#options.grid.distribution) {
                    case 'linear':
                        //Array already has first prise
                        for (let i = 0; i < this.#options.grid.ordersNumber - 1; i++) {
                            switch (this.#options.algorithm) {
                                case 'long':
                                    gridPrices.push(await this.filterPrice(gridPrices[i] - step));
                                    break;
                                default:
                                    reject(new Error('Wrong algorithm!'));
                                    break;
                            }
                        }
                        break;
                
                    case 'logarithmic':
                        for (let i = 0; i < this.#options.grid.ordersNumber - 1; i++) {
                            switch (this.#options.algorithm) {
                                case 'long':
                                    gridPrices.push(gridPrices[i] - step);
                                    break;
                                default:
                                    reject(new Error('Wrong algorithm!'));
                                    break;
                            }
                        }
                        
                        for (let i = 1; i < this.#options.grid.ordersNumber - 1; i++) {
                            switch (this.#options.algorithm) {
                                case 'long':
                                    const newDistance = (gridPrices[i - 1] - gridPrices[i]) / this.#options.grid.logFactor;
                                    gridPrices[i] = await this.filterPrice(gridPrices[i - 1] - newDistance);
                                    break;
                                default:
                                    reject(new Error('Wrong algorithm!'));
                                    break;
                            }
                        }

                        //Filter last price
                        gridPrices[gridPrices.length - 1] = await this.filterPrice(gridPrices[gridPrices.length - 1]);
                        
                        break;

                    default:
                        reject(new Error('Wrong distribution'))
                        break;
                }

                resolve(gridPrices);
            } catch (err) {
                reject(new Error(err));
            }
        });
    }

    async userDataCallback(data) {
        try {
            if (data.e == 'executionReport') console.log(data);
            if (data.e == 'executionReport' && data.X == 'FILLED') {
                const orderType = await this.determineOrder(data);
                switch (orderType) {
                    case 'GRID':
                        for (let i = 0; i < this.orders.grid.length; i++) {
                            const order = this.orders.grid[i];

                            if (order.orderId == data.i) {
                                this.orders.grid[i].status = data.X;
                            }
                        }

                        await this.createTakeProfit(data.s);
                        break;
                    case 'TAKEPROFIT':
                        await this.cancelGrid(symbol);
                        break;
                    default:
                        // console.log('Its other order!');
                        break;
                }
            }
        } catch (err) {
            console.log(err);
            throw new Error(err);
        }
    }

    async createTakeProfit(symbol) {
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof this.orders.takeProfit != 'undefined') {
                    if (this.#options.verbose) console.log(`[${this.options.pair}] Cancel old takeprofit`);
                    await this.cancelTakeProfit(symbol);
                }

                const priceMultiplier = this.#options.grid.profit / 100 + 1;

                const price = await this.filterPrice((await this.calculateAverageFilledPrice(symbol)) * priceMultiplier);
                const volume = await this.filterLotSize(symbol, await this.calculateFilledVolume(symbol));

                if (this.#options.verbose) console.log(`[${this.options.pair}] Place takeprofit order. Price: ${price} Volume: ${volume}`);

                const binanceResponse = await this.binance.order('SELL', symbol, volume, price, {
                    type: 'LIMIT'
                });

                this.orders.takeProfit = {
                    orderId: binanceResponse.orderId,
                    side: binanceResponse.side,
                    status: binanceResponse.status,
                    price: +binanceResponse.price,
                    qty: +binanceResponse.origQty
                }

                resolve(this.orders.takeProfit);
            } catch (err) {
                console.error(err);
                reject(new Error('createTakeProfit | ' + err));
            }
        });
    }

    cancelTakeProfit(symbol) {
        return new Promise(async (resolve, reject) => {
            try {
                const takeProfit = this.orders.takeProfit;
                if (typeof takeProfit === 'undefined') {
                    resolve();
                } else {
                    await this.binance.cancel(symbol, takeProfit.orderId, (err, response, symbol) => {
                        if (err) reject(err);

                        delete this.orders.takeProfit;

                        resolve();
                    });
                }
            } catch (err) {
                reject(new Error('cancelTakeProfit | ' + err));
            }
        });
    }

    cancelGrid(symbol) {
        return new Promise(async (resolve, reject) => {
            try {
                //Check if all orders filled
                let filledOrdersCounter = 0;
                for (let i = 0; i < this.orders.grid.length; i++) {
                    const order = this.orders.grid[i];
                    if (order.status == 'FILLED') filledOrdersCounter++;
                }

                if (filledOrdersCounter == this.orders.grid.length) {
                    delete this.orders.grid;
                    resolve();
                }

                //Close opened orders
                this.binance.openOrders(symbol, async (err, openOrders) => {
                    if (err) reject(err);

                    for (const openedOrder of openOrders) {
                        for (const order of this.orders.grid) {
                            if (openedOrder.orderId == order.orderId) {
                                await this.binance.cancel(symbol, openedOrder.orderId);
                            }
                        }
                    }

                    resolve();
                });
            } catch (err) {
                reject(new Error('cancelGrid | ' + err));
            }
        });
    }

    determineOrder(data) {
        return new Promise((resolve, reject) => {
            try {
                if (this.#options.verbose) console.log(`[${this.options.pair}] Determine order type`);

                //Check if it is TAKEPROFIT
                const takeProfit = this.orders.takeProfit;
                if (typeof takeProfit != 'undefined') {
                    if (takeProfit.orderId == data.i) {
                        if (this.#options.verbose) console.log(`[${this.options.pair}] Its TAKEPROFIT order`);
                        resolve('TAKEPROFIT');
                    }
                }

                //Check if it is GRID
                if (typeof this.orders.grid != 'undefined') {
                    for (let i = 0; i < this.orders.grid.length; i++) {
                        const order = this.orders.grid[i];

                        if (order.orderId == data.i) {
                            if (this.#options.verbose) console.log(`[${this.options.pair}] Its GRID order`);
                            resolve('GRID');
                        }
                    }
                }

                resolve();
            } catch (err) {
                reject(new Error(`[${this.options.pair}] determineOrder | ` + err));
            }
        });
    }

    calculateAverageFilledPrice(symbol) {
        return new Promise((resolve, reject) => {
            try {
                let price = 0.0;
                let ordersNumber = 0;
                for (let i = 0; i < this.orders.grid.length; i++) {
                    const order = this.orders.grid[i];

                    if (order.status == 'FILLED') {
                        ordersNumber += 1;
                        price += order.price;
                    }
                }

                if (price === 0.0) {
                    reject();
                } else {
                    resolve(price / ordersNumber);
                }
            } catch (err) {
                reject(new Error('calculateAverageFilledPrice | ' + err));
            }
        });
    }

    calculateFilledVolume(symbol) {
        return new Promise(async (resolve, reject) => {
            try {
                let volume = 0.0;
                for (let i = 0; i < this.orders.grid.length; i++) {
                    const order = this.orders.grid[i];

                    if (order.status == 'FILLED') {
                        volume += +order.qty;
                    }
                }

                if (volume === 0.0) {
                    reject();
                } else {
                    console.log('Filled volume: ' + volume);
                    resolve(volume);
                }

                reject();
            } catch (err) {
                reject(new Error('calculateFilledVolume | ' + err));
            }
        });
    }

    filterPrice(price) {
        return new Promise((resolve, reject) => {
            try {
                if (typeof price === 'undefined') return reject(new Error('Price in checking filter undefined!'));

                const priceFilter = this.pairsInfo.filters.find((filter) => filter.filterType === 'PRICE_FILTER');

                if (price < priceFilter.minPrice) {
                    reject(new Error(`[${this.options.pair}] Price less than Binance require!`));
                }

                if (price > priceFilter.maxPrice) {
                    reject(new Error(`[${this.options.pair}] Price greater than Binance require!`));
                }

                const priceTickSizeRemainder = (price - priceFilter.minPrice) % priceFilter.tickSize;
                if (priceTickSizeRemainder != 0) {
                    const tokens = priceFilter.tickSize.split('.');
                    let precision = 0;
                    for (let i = 0; i < tokens[1].length; i++) {
                        precision++;
                        if (tokens[1][i] == '1') break;
                    }
                    resolve(+price.toFixed(precision));
                }

                resolve(price);
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }

    filterNotionalValue(symbol, value) {
        return new Promise((resolve, reject) => {
            try {
                const priceFilter = this.pairsInfo.filters.find((filter) => filter.filterType === 'MIN_NOTIONAL');

                if (value < priceFilter.minNotional) {
                    console.log(value, priceFilter.minNotional);
                    reject(new Error(`[${this.options.pair}] Notional value less than Binance required!`));
                }

                resolve(value);
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }

    filterLotSize(symbol, volume) {
        return new Promise((resolve, reject) => {
            try {
                const volumeFilter = this.pairsInfo.filters.find((filter) => filter.filterType === 'LOT_SIZE');

                if (volume < volumeFilter.minQty) {
                    reject(new Error(`[${this.options.pair}] Lot less than Binance require!`));
                }

                if (volume > volumeFilter.maxQty) {
                    reject(new Error(`[${this.options.pair}] Lot greater than Binance require!`));
                }

                const volumeStepSizeRemainder = (volume - volumeFilter.minQty) % volumeFilter.stepSize;
                if (volumeStepSizeRemainder != 0) {
                    const tokens = volumeFilter.stepSize.split('.');
                    let precision = 0;
                    if (tokens[0] != '1') {
                        for (let i = 0; i < tokens[1].length; i++) {
                            precision++;
                            if (tokens[1][i] == '1') break;
                        }
                    }
                    resolve(+volume.toFixed(precision));
                }

                resolve(volume);
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }
}

module.exports = {
    DcaBot
}