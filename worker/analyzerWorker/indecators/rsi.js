const rma = require("./rma");

class RSI {
    /**
     * @param {Array} source array of prices. Should contain +1 element 
     *                       for calculating amount of length gains and losses.
     *                       For example, length is 14, than source should contain 15 prices.
     * @param {Integer} length
     * @returns RSI value
     */
    calculate(source, length, symbol, timeframe) {
        let gains = [];
        let losses = [];

        for (let i = 0; i < source.length; i++) {
            //Skip calculations for last price
            if (i === source.length - 1) break;

            const change = source[i] - source[i + 1];
            if (change > 0) {
                gains.push(change);
                losses.push(0.0);
            } else {
                losses.push(Math.abs(change));
                gains.push(0.0);
            }
        }

        const avgGain = rma.calculate(gains, length, 'GAIN', {
            symbol,
            timeframe
        });
        const avgLoss = rma.calculate(losses, length, 'LOSS', {
            symbol,
            timeframe
        });

        const rs = avgGain / avgLoss;

        return 100 - (100 / (1 + rs));
    }
}

module.exports = new RSI();