class SMA {
    /**
     * Caculate SMA according to array of the prices and length
     * Formula: sum of values / length
     * 
     * @param {Array} source array of prices
     * @param {Integer} length length of the sma
     */
    calculate(source, length) {
        if (source.length < length) throw new Error('Source length is less than required');

        let sum = 0.0;
        for (let i = 0; i < length; i++) {
            sum += source[i]
        }

        return sum / length;
    }
}

module.exports = new SMA();