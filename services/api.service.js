const apiWorkerManager = require('../worker/apiWorkerManager/index');
const Binance = require('node-binance-api');

class ApiService {
    async deleteApi(key, secret) {
        try {
            await apiWorkerManager.deleteWorker(key, secret);
        } catch (err) {
            console.log(err);
        }
    }

    checkApi(key, secret, exchange) {
        return new Promise(async (resolve, reject) => {
            const binance = new Binance().options({
                APIKEY: key,
                APISECRET: secret,
                useServerTime: true,
                recvWindow: 60000,
                test: true
            });

            console.log(key, secret, exchange);

            switch (exchange) {
                case 'Binance Spot':
                    try {
                        const response = await binance.marketBuy("ETHUSDT", 1);
                    } catch (err) {
                        const response = {
                            status: false
                        }

                        if (err.body) {
                            if (JSON.parse(err.body).code == -2014) {
                                response.message = 'API ключи неверные';
                            }
                        }

                        resolve(response);
                    }
                    break;
                case 'Binance Futures':
                    try {
                        const response = await binance.futuresMarketBuy('ETHUSDT', 1);

                        if (response.code) {
                            if (response.code == -2014) {
                                resolve({
                                    status: false,
                                    message: 'API ключи неверные'
                                })
                            }
                        }
                    } catch (err) {
                        const response = {
                            status: false
                        }

                        if (err.body) {
                            if (JSON.parse(err.body).code == -2014) {
                                response.message = 'API ключи неверные';
                            }
                        }

                        resolve(response);
                    }
                    break;
                default:
                    resolve({ status: false, message: 'Неверная биржа' });
            }

            resolve({ status: true });
        });
    }

    async getPairs() {
        return new Promise(async (resolve, reject) => {
            const binance = new Binance().options({
                APIKEY: '',
                APISECRET: '',
                useServerTime: true,
                recvWindow: 60000,
                test: true
            });

            const futuresPairs = (await binance.futuresExchangeInfo()).symbols.map(info => info.symbol);
            const spotPairs = (await binance.exchangeInfo()).symbols.map(info => info.symbol);

            resolve({
                spotPairs: spotPairs,
                futuresPairs: futuresPairs
            });
        })
    }
}

module.exports = new ApiService();