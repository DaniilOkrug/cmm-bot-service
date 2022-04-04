const Binance = require('node-binance-api');
const rsi = require('./indecators/rsi');

module.exports = class Analyzer {
    options = {};

    constructor(options) {
        this.options = options;
        console.log(this.options);
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
                    console.log('[Analyzer] check price changes');
                    const limit = this.getLimit();
                    const priceChangeSignal = await this.checkPriceChanges(limit, pair);
                    if (!priceChangeSignal) {
                        resolve(false)
                    }
                }
                
                //Analyze volumes
                if (this.options.minVolume > 0) {
                    console.log('[Analyzer] check volume');
                    const volumeSignal = await this.checkVolume(pair);
                    if (!volumeSignal) {
                        resolve(false)
                    }
                }

                //Ananlyze RSI
                if(this.options.rsi.enabled) {
                    console.log('[Analyzer] check rsi');
                    const rsiSignal = await this.checkRSI(pair);
                    if (!rsiSignal) {
                        resolve(false)
                    }
                }

                resolve(true);
            } catch (err) {
                console.error(err);
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

                if (index === array.length - 1) resolve(priceChanges);
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
                reject(err);
            }
        })
    }

    checkVolume(pair) {
        return new Promise((resolve, reject) => {
            this.binance.prevDay(pair, (error, prevDay, symbol) => {
                if (prevDay.volume >= this.options.minVolume) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        })
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

                console.log('[Analyzer] RSI', pair, timeframe, rsiCurrentValue);

                if (rsiCurrentValue > this.options.rsi.value) {
                    resolve(false);
                    break;
                }
            }

            resolve(true);
        });
    }
}