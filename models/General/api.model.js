const { Schema, model } = require('mongoose');

const ApiShema = new Schema({
    user: { type: Schema.Types.ObjectId, red: 'User' },
    key: { type: String, required: true },
    secret: { type: String, required: true },
    name: { type: String, required: true },
    exchange: { type: String, required: true },
    status: { type: String, default: 'Active' }
});

module.exports = model('Api', ApiShema);