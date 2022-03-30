const { Server } = require("socket.io");

class SocketService {
    io;

    connect() {
        this.io = new Server(process.env.WSBOT_PORT)
        ;

        this.io.on('connection', this.onConnect)
    }

    onConnect(socket) {
        console.log('WebSocket connection!');

        socket.on('disconnect', () => {
            console.log('WebSocket disconnected!');
        });
    }

    sendBotUpdate(value) {
        this.io.emit('BOT_STATUS_UPDATE', JSON.stringify(value));
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {  
            Singleton.instance = new SocketService();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton.getInstance();

