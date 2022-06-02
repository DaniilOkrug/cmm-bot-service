require('dotenv').config();

const express = require('express');
const { connectDB } = require('./loaders/connectionDB.loader');

const router = require('./router/index');

const proxyService = (require('./services/proxy.service')).getInstance();
const analyzerService = (require('./services/analyzer.service')).getInstance();
const botmanagerService = require('./services/botmanager.service');
const socketService = require('./services/socket.service');

const { logger } = require('./utils/logger/logger');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use('/api', router);

const start = async () => {
    try {
        const connection = await connectDB();
        await proxyService.loadProxies();

        app.listen(PORT, () => console.log(`Server started in development mode on PORT = ${PORT}`));
    
        //Create analyzer
        analyzerService.createWorker(proxyService.analyzerProxy);

        //Start available bots
        await botmanagerService.start();

        socketService.connect();
    } catch (err) {
        console.log(err);
        logger.error(err);
    }
}

start();