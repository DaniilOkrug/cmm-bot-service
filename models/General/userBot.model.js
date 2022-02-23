const { Schema, model } = require('mongoose');

const UserBotShema = new Schema({
    user: { type: Schema.Types.ObjectId, red: 'User' },
    api: { type: Schema.Types.ObjectId, red: 'Api' },
    bot: { type: Schema.Types.ObjectId, red: 'Bot' },
    pair: { type: String, required: true },
    status: { type: String, default: "Disabled" },
    deposit: { type: Number, required: true },
});

module.exports = model('UserBot', UserBotShema);