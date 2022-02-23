const mongoose = require('mongoose');

module.exports = {
    connectDB(url) {
        return new Promise(async (resolve, reject) => {
            try {
                const connection = mongoose.connect(process.env.SERVER_DB, { 
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                });

                resolve(connection);
            } catch (err) {
                reject(err);
            }
        })
    }
}