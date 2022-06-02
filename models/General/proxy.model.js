const { Schema, model } = require('mongoose');

const ProxySchema = new Schema({
    address: { type: String, required: true },
    portHTTP: { type: Number, required: true },
    portSOCKS: { type: Number, required: true },
    username: { type: String },
    password: { type: String }
});

module.exports = model('Proxy', ProxySchema);