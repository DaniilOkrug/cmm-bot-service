require('dotenv').config();
const expect = require('chai').expect;
const assert = require('chai').assert;

const Binance = require('node-binance-api');
const { connectDB } = require('../loaders/connectionDB.loader');
const apiModel = require('../models/General/api.model');
const userBotModel = require('../models/General/userBot.model');
const Analyzer = require('../worker/analyzerWorker/analyzer');
const rma = require('../worker/analyzerWorker/indecators/rma');
const rsi = require('../worker/analyzerWorker/indecators/rsi');
const botManager = require('../worker/botManager');
const dcaBotManager = require("../worker/dcaWorkerManager/index");

describe("Dca bot manager tests", function () {
    this.timeout(10000);

    before(async () => {
        await connectDB();
    });

    describe("Signal", () => {
        it("Handle signal and create bot worker", (done) => {
            const pair = "XRPBUSD";
            const key = "5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ";
            const secret = "iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A";

            dcaBotManager.handleSignal(pair, key, secret)
                .then(data => {
                    const objKeys = Object.keys(data);
                    console.log(workerData);

                    assert(objKeys.length == 4, "Worker data object number is wrong!");
                    assert(objKeys.includes("botId"), "botId is missed in worker data!");
                    assert(objKeys.includes("key"), "key is missed in worker data!");
                    assert(objKeys.includes("secret"), "secret is missed in worker data!");
                    assert(objKeys.includes("worker"), "botId is missed in worker data!");
                    assert(data.key === key, "Worker api key is wrong!")
                    assert(data.secret === secret, "Worker api key is wrong!")

                    done();
                })
                .catch(err => done(err));
        });
    });
});

describe("Database models tests", function () {
    this.timeout(10000);

    before(async () => {
        await connectDB();
    });

    describe("API Model", () => {
        it("Find existed API", (done) => {
            const key = "5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ";
            const secret = "iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A";

            apiModel.find({ key, secret }, (err, res) => {
                if (err) done(err);

                assert(res.length === 1, `APIs array from database has length ${res.length}`);
                done();
            });
        });
    });

    describe("User Bot Model", () => {
        const key = "5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ";
        const secret = "iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A";
        const botName = "First bot";

        beforeEach(async () => {
            const apiData = await apiModel.findOne({ key, secret });
            const userBot = await userBotModel.findOneAndUpdate({ api: apiData._id, name: botName }, { status: "Wait" });
        });

        afterEach(async () => {
            const apiData = await apiModel.findOne({ key, secret });
            const userBot = await userBotModel.findOneAndUpdate({ api: apiData._id, name: botName }, { status: "Wait" });
        });

        it("Find and Update existed bot with existed API from Wait to Active status", () => {
            return new Promise(async (resolve, reject) => {
                const apiData = await apiModel.findOne({ key, secret });

                const oldUserBotData = await userBotModel.findOneAndUpdate({ api: apiData._id, name: botName, status: "Wait" }, { status: "Active" });

                userBotModel.findOne({ key, secret }, (err, res) => {
                    if (err) reject(err);

                    assert(res.status === "Active", "Updating User Bot status to Active is failed!");
                    resolve()
                });
            });
        });

        it("Find and Update status of bot with API and status", () => {
            return new Promise(async (resolve, reject) => {
                const apiData = await apiModel.findOne({ key, secret });

                const oldUserBotData = await userBotModel.findOneAndUpdate({ api: apiData._id, status: "Wait" }, { status: "Active" });

                userBotModel.findOne({ key, secret }, (err, res) => {
                    if (err) reject(err);

                    assert(res.status === "Active", "Updating User Bot status to Active is failed!");

                    resolve()
                });
            });
        });
    });
});

describe("Bot Manager tests", function () {
    this.timeout(10000);
    
    it("Update settigns", () => {
        return new Promise(async (reslove, reject) => {
            const key = "5RMBk5HdpO8wi0MmJcW8wXd4jn6b1HEw515HrsxXMgxH65MrC6h1X9HmyRKLICgJ";
            const secret = "iwbtaf44ohwDxI2y8wkIbLpJ5NfAFRdT4hucH0YehJaKcUG2skGEKpLstIetCy1A";
            const botSettings = { settings: 1 }
            const newBotSettings = { settings: 2 }

            await botManager.createWorker(key, secret, botSettings);

            setTimeout(() => {
                botManager.updateBotSettings(newBotSettings)
                setTimeout(() => reslove(), 3000)
            },3000);
        });
    });
});

describe("Inidcators test", function() {
    it("RSI", async () => {
        let binance = new Binance().options({
            useServerTime: true,
            recvWindow: 60000,
        });

        const ticks = await binance.candlesticks("COMPUSDT", '1m', false, { limit: 15 });

        const closePrices = [];
        ticks.forEach((tick, index, array) => {
            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = tick;

            closePrices.push(close);
        });

        const rsiValue = rsi.calculate(closePrices.reverse(), 14, 'COMPUSDT');

        console.log(rsiValue);
    });
});

describe("Analyzer test", function () {
    this.timeout(10000);
    it("getSignal", async () => {
        const analyzer = new Analyzer({
            enabled: true,
            period: '1h',
            interval: '1m',
            priceChange: 0.01,
            minPriceChangeNumber: 1,
            minVolume: 1000,
            algorithm: 'long',
            rsi: {
                enabled: true,
                length: 14,
                timeframes: ['1m', '5m', '15m', '1d'],
                value: 70
            }
        });

        const signal = await analyzer.getSignal('XRPUSDT');

        console.log(signal);
    });
});