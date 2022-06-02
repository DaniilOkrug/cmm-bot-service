const ProxyModel = require('../models/General/proxy.model');

const { logger } = require('../utils/logger/logger');

/**
 * 1 proxy for Analyzer
 * Others proxies for bots
 */
class ProxyService {
    //Proxy for analyzer
    #analyzerProxy;

    /**
     * Array of proxies for analyzer
     * Format: 
     * [
     *  {
     *      proxy: proxyObj,
     *      botsIds: [botsIds]
     *  }
     * ]
     */
    #botsProxy;

    #jobQueue = [];
    #jobExecutionStatus = 'Wait'; // Wait/Executing

    get analyzerProxy() {
        return this.#analyzerProxy;
    }

    get botsProxy() {
        return this.#botsProxy;
    }

    loadProxies() {
        return new Promise(async (resolve, reject) => {
            const proxies = (await ProxyModel.find()).map(data => data._doc);
            if (proxies.length < 2) throw new Error('Too small number of proxies!');

            this.#analyzerProxy = proxies[0];
            this.#botsProxy = proxies.slice(1).map((proxy) => {
                return {
                    proxy,
                    botsIds: []
                }
            });

            console.log('Current proxies', this.#botsProxy);

            resolve();
        });
    }

    setBotProxy(botId) {
        return new Promise((resolve, reject) => {
            const existedBotProxy = this.#botsProxy.find(botProxy => botProxy.botsIds.includes(botId));

            if (typeof existedBotProxy !== 'undefined') {
                logger.error(`Bot ${botId} has proxy!`);
                return reject(new Error('Bot has proxy!'));
            }

            const availableProxy = this.#botsProxy.find(botProxy => botProxy.botsIds.length < 10);
            if (typeof availableProxy === 'undefined') {
                logger.error('No availbale proxies!');
                return reject(new Error('No availbale proxies!'));
            }

            const proxyIndex = this.#botsProxy.indexOf(availableProxy);
            this.#botsProxy[proxyIndex].botsIds.push(botId);

            console.log('After adding bot proxy', this.#botsProxy);

            resolve(availableProxy.proxy);
        });
    }

    deleteBotProxy(botId) {
        return new Promise((resolve, reject) => {
            const botProxy = this.#botsProxy.find(botProxy => botProxy.botsIds.includes(botId));

            if (typeof botProxy === 'undefined') return resolve();

            const proxyIndex = this.#botsProxy.indexOf(botProxy);
            const botIdIndex = this.#botsProxy[proxyIndex].botsIds.indexOf(botId)
            this.#botsProxy[proxyIndex].botsIds.splice(botIdIndex, 1);

            console.log('After deleting bot proxy', this.#botsProxy);

            resolve();
        });
    }

    job = {
        // addBotProxy: (botId) => {
        //     this.#jobQueue.push({
        //         task: "ADD",
        //         data: botId
        //     });

        //     if (this.#jobQueue.length > 0 && this.#jobExecutionStatus === 'Wait') {
        //         this.#jobExecutionStatus = 'Executing';
                
        //         const currentTask = this.#jobQueue.shift();
        //         this.job.executeTask(currentTask);
        //     }
        // },

        deleteBotProxy: (botId) => {
            this.#jobQueue.push({
                task: "DELETE",
                data: botId
            });

            if (this.#jobQueue.length > 0) {
                this.#jobExecutionStatus = 'Executing';

                const currentTask = this.#jobQueue.shift();
                this.job.executeTask(currentTask);
            }
        },

        executeTask: (job) => {
            return new Promise(async (resolve, reject) => {
                switch (job.task) {
                    // case 'ADD':
                        // await this.setBotProxy(job.data);
                        // break;
                    
                    case 'DELETE':
                        await this.deleteBotProxy(job.data);

                    default:
                        break;
                }

                if (this.#jobQueue.length > 0) {
                    this.#jobExecutionStatus = 'Executing';

                    const currentTask = this.#jobQueue.shift();
                    await this.job.executeTask(currentTask);
                } else {
                    this.#jobExecutionStatus = 'Wait';
                }

                resolve();
            });
        }
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new ProxyService();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton;