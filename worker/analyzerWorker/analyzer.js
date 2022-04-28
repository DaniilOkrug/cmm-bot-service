const Binance = require('node-binance-api');
const rsi = require('./indecators/rsi');
const { logger } = require('../../utils/logger/logger');

module.exports = class Analyzer {
    options = {};

    constructor(options) {
        this.options = options;
    }

    getSignal(pair) {
        return new Promise(async (resolve, reject) => {
            try {
                this.binance = new Binance().options({
                    useServerTime: true,
                    recvWindow: 60000,
                });

                //Analyze intervals for price changes
                if (this.options.minPriceChangeNumber > 0) {
                    const limit = this.getLimit();
                    console.log(limit);
                    const priceChangeSignal = await this.checkPriceChanges(limit, pair);
                    if (!priceChangeSignal) {
                        console.log(`[Analyzer] ${pair} price changes is bad!`);
                        return resolve(false);
                    }

                    console.log(`[Analyzer] ${pair} price changes is good!`);
                }
                
                //Analyze volumes
                if (this.options.minVolume > 0) {
                    const volumeSignal = await this.checkVolume(pair);
                    if (!volumeSignal) {
                        console.log(`[Analyzer] ${pair} volume is bad!`);
                        return resolve(false);
                    }

                    console.log(`[Analyzer] ${pair} volume is good!`);
                }

                //Ananlyze RSI
                if (this.options.rsi.enabled) {
                    const rsiSignal = await this.checkRSI(pair);
                    if (!rsiSignal) {
                        console.log(`[Analyzer] ${pair} RSI is bad!`);
                        return resolve(false);
                    }

                    console.log(`[Analyzer] ${pair} RSI is good!`);
                }

                //Analyze pump and dump
                if (this.options.pampAndDump.enabled) {
                    const pumpAndDumpSignal = await this.checkPriceChangeRate(pair);

                    if (!pumpAndDumpSignal) {
                        console.log(`[Analyzer] ${pair} Pump and Dump is bad!`);
                        return resolve(false);
                    }

                    console.log(`[Analyzer] ${pair} Pump and Dump is good!`);
                }

                resolve(true);
            } catch (err) {
                console.error(err);
                logger.error(err);
                resolve(err);
            }
        });
    }

    calculatePriceChanges(ticks) {
        return new Promise((resolve, reject) => {
            let priceChanges = 0;
            ticks.forEach((tick, index, array) => {
                let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = tick;
                if (this.options.algorithm == 'long' && open > close) {
                    const change = ((open - close) / open) * 100;
                    if (change > this.options.priceChange) {
                        priceChanges++;
                    }
                }

                if (index === array.length - 1) return resolve(priceChanges);
            });
        })
    }

    checkPriceChanges(limit, pair) {
        return new Promise(async (resolve, reject) => {
            try {
                //Calculate price changes
                const ticks = await this.binance.candlesticks(pair, this.options.interval, false, { limit: limit });
                const priceChanges = await this.calculatePriceChanges(ticks);

                console.log('Price changes: ' + priceChanges);

                //Check price
                if (priceChanges >= this.options.minPriceChangeNumber) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            } catch (err) {
                console.error(err);
                logger.error(err);
                resolve(err);
            }
        })
    }

    checkVolume(pair) {
        return new Promise((resolve, reject) => {
            this.binance.prevDay(pair, (error, prevDay, symbol) => {
                if (error) {
                    console.log(error);
                    logger.error(error);
                    return resolve(false);
                }
                
                if (prevDay.volume >= this.options.minVolume) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        })
    }

    checkPriceChangeRate(pair) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.options.pampAndDump.enabled) return resolve(true);
                if (this.options.pampAndDump.filters.length == 0) return resolve(true);

                const maxMinutes = Math.max.apply(Math, this.options.pampAndDump.filters.map(function (filter) { return filter.period }));

                const ticks = await this.binance.candlesticks(pair, '1m', false, { limit: maxMinutes });

                //Check if ticks is valid array
                if (typeof ticks === 'undefined') {
                    console.log(`[Analyzer] ${pair} Ticks are undefined!`);
                    logger.error(`[Analyzer] ${pair} Ticks are undefined!`);
                    return resolve(false);
                }

                if (ticks.length == 0) {
                    console.log(`[Analyzer] ${pair} Ticks array length is 0!`);
                    logger.error(`[Analyzer] ${pair} Ticks array length is 0!`);
                    return resolve(false);
                }

                //Calculate and check price change percent
                for (const filter of this.options.pampAndDump.filters) {
                    const firstTickOpen = ticks[ticks.length - 1][1];
                    const lastTickClose = ticks[0][4];

                    const priceChangePercent = Math.abs(((firstTickOpen - lastTickClose) / lastTickClose) * 100); 
                    
                    if (isNaN(priceChangePercent)) {
                        console.log(`[Analyzer] ${pair} Tick price change percent is NAN!`);
                        logger.error(`[Analyzer] ${pair} Tick price change percent is NAN!`);
                        return resolve(false);
                    }

                    //Check price change precent for invalid condition
                    if (priceChangePercent > filter.priceChange) {
                        return resolve(false);
                    }
                }

                resolve(true);
            } catch (err) {
                console.log(err);
                logger.error(err)
                resolve(false);
            }
        });
    }

    checkRSI(pair) {
        return new Promise(async (resolve, reject) => {
            for (const timeframe of this.options.rsi.timeframes) {
                const ticks = await this.binance.candlesticks(pair, timeframe, false, { limit: this.options.rsi.length + 1 });

                const closePrices = [];
                for (const tick of ticks) {
                    let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = tick;
                    closePrices.push(close);
                }

                const rsiCurrentValue = rsi.calculate(closePrices.reverse(), this.options.rsi.length, pair, timeframe);

                // console.log('[Analyzer] RSI', pair, timeframe, rsiCurrentValue);
                if (isNaN(rsiCurrentValue)) {
                    console.log(`[Analyzer] ${pair} RSI is NAN!`);
                    logger.error(`[Analyzer] ${pair} RSI is NAN!`);
                    return resolve();
                }

                if (rsiCurrentValue > this.options.rsi.value) {
                    return resolve(false);
                }
            }

            resolve(true);
        });
    }

    getLimit() {
        //Determine limit for the candlesticks
        const periodToken = (this.options.period.match(/(\d+)/))[0];
        const periodTypeToken = this.options.period[this.options.period.length - 1];

        const intervalToken = (this.options.interval.match(/(\d+)/))[0];
        const intervalTypeToken = this.options.interval[this.options.interval.length - 1];

        let limit = 0;
        switch (intervalTypeToken) {
            case 'm':
                switch (periodTypeToken) {
                    case 'm':
                        if (periodToken > intervalToken) {
                            limit = Math.ceil(periodToken / intervalToken);
                        } else {
                            throw new Error('Interval bigger than period');
                        }
                        break;
                    case 'h':
                        limit = Math.ceil((periodToken * 60) / intervalToken);
                        break;
                    case 'd':
                        limit = Math.ceil((periodToken * 24 * 60) / intervalToken);
                        break;
                    default:
                        break;
                }

                break;
            case 'h':
                switch (periodTypeToken) {
                    case 'm':
                        throw new Error('Interval bigger than period');
                    case 'h':
                        if (periodToken > intervalToken) {
                            limit = Math.ceil(periodToken / intervalToken);
                        } else {
                            throw new Error('Interval bigger than period');
                        }
                        break;
                    case 'd':
                        limit = Math.ceil((periodToken * 24) / intervalToken);
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }

        return limit;
    }
}