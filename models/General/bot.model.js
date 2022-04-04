const { Schema, model } = require('mongoose');

//Bots created by Admin
const BotShema = new Schema({
    pairs: { type: [String], required: true },
    settings: {
        algorithm: { type: String, required: true },
        analyzer: {
            enabled: { type: Boolean, required: true },
            period: { type: String },
            interval: { type: String },
            priceChange: { type: Number },
            minPriceChangeNumber: { type: Number },
            minVolume: { type: Number },
            rsi: {
                enabled: { type: Boolean, default: false },
                length: { type: Number, default: 14 },
                value: { type: Number, default: 70 },
                timeframes: { type: Array, default: ['1m'] }
            }
        },
        grid: {
            size: { type: Number, required: true },
            ordersNumber: { type: Number, required: true },
            martingeil: { type: Number, required: true },
            indentFirstOrder: { type: Number, required: true },
            profit: { type: Number, required: true },
            priceFollow: { type: Number, required: true },
            priceFollowDelay: { type: Number, required: true }, //minutes
            newGridDelay: { type: Number, required: true },
            endCycleDelay: { type: Number, required: true },
        }
    },
});

module.exports = model('Bot', BotShema);