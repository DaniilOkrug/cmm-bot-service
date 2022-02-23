const apiWorkerManager = require('../worker/apiWorkerManager/index');

class ApiService {
    #apiListeners = [];

    async checkApi() {
        return false;
    }

    async createApiListener(key, secret) {
        apiWorkerManager.createWorker(key, secret)
            .then(data => {
                this.#apiListeners.push({
                    key,
                    secret
                });
            })
    }

    async closeApiListeners(key, secret) {
        
    }
}

module.exports = new ApiService();