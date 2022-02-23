require('dotenv').config();
const express = require('express');
const { connectDB } = require('./loaders/connectionDB.loader');
const router = require('./router/index');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use('/api', router);

const start = async () => {
    try {
        const connection = await connectDB();

        app.listen(PORT, () => console.log(`Server started in development mode on PORT = ${PORT}`))
    } catch (err) {
        console.log(err);
    }
}

start();