const sma = require("./sma");

class RMA {
    #previousGain = {};
    #previousLoss = {};
    
    /**
     * 
     * @param {Array} source 
     * @param {Integer} length 
     * @param {String} type GAIN/LOSS
     * @param {*} graphInfo { symbol, timeframe}
     * @returns 
     */
    calculate(source, length, type, graphInfo) {
        try {
            if (source.length < length) throw new Error('Source length is less than required');

            const { symbol, timeframe } = graphInfo;

            if (!this.#previousGain[symbol]) {
                this.#previousGain[symbol] = {};
            }

            if (!this.#previousLoss[symbol]) {
                this.#previousLoss[symbol] = {};
            }

            let sum = 0.0;
            if (type === 'GAIN') {
                sum = sma.calculate(source, length);
                // if (!this.#previousGain[symbol][timeframe]) {
                //     sum = sma.calculate(source, length);
                // } else {
                //     sum = (source[0] + (length - 1) * this.#previousGain[symbol][timeframe]) / length;
                // }
            } else if (type === 'LOSS') {
                sum = sma.calculate(source, length);
                // if (!this.#previousLoss[symbol][timeframe]) {
                //     sum = sma.calculate(source, length);
                // } else {
                //     sum = (source[0] + (length - 1) * this.#previousLoss[symbol][timeframe]) / length;
                // }
            } else {
                throw new Error('Wrong calucate type in RMA');
            }

            if (type == 'GAIN') {
                this.#previousGain[symbol][timeframe] = sum;
            } else {
                this.#previousLoss[symbol][timeframe] = sum;
            }

            return sum;
        } catch (error) {
            console.log(error);
        }
    }

    get previousGain() { return this.#previousGain; }
    get previousLoss() { return this.#previousLoss; }
}

module.exports = new RMA();