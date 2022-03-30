const Binance = require('node-binance-api');

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

                //Analyze intervals

                const signal = await this.checkIntervals(limit, pair);

                resolve(signal);
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

    checkIntervals(limit, pair) {
        return new Promise(async (resolve, reject) => {
            try {
                // console.log(`[${pair}] Analyzer: Check intervals`);

                let priceChanges = 0;

                //Calculate price changes
                if (this.options.minPriceChangeNumber > 0) {
                    const ticks = await this.binance.candlesticks(pair, this.options.interval, false, { limit: limit });

                    priceChanges = await this.calculatePriceChanges(ticks);
                }

                // console.log('Price changes: ' + priceChanges);

                if (this.options.minVolume > 0) {
                    new Promise(() => {
                        this.binance.prevDay(pair, (error, prevDay, symbol) => {
                            if (prevDay.volume >= this.options.minVolume && priceChanges >= this.options.minPriceChangeNumber) {
                                resolve(true);
                            }
                        });
                    })
                }

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
}