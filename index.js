// Dependencies
const express = require('express');
const WebSocket = require('ws');
const SocketServer = require('ws').Server;
const sqlite3 = require('sqlite3').verbose();

const server = express().listen(3000);
const wss = new SocketServer({ server });
let db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});
db.run('CREATE TABLE msgs(name text, msg text)');

wss.on('connection', (ws) => {
    console.log("[Server] A client was connected");

    ws.on('close', () => { console.log('[Server] A client disconnected') });

    ws.on('message', (message, isBinary) => {
        message = isBinary ? message : message.toString();
        console.log('[Server] Received message: %s, %b', message, isBinary);
        try {
            let m = JSON.parse(message);
            handleMessage(m, wss.clients, ws);
        } catch(err) {
            console.log('[Server] Message is not parseable')
            console.log(err);
        }
    });
});

// db.close((err) => {
//     if (err) {
//       return console.error(err.message);
//     }
//     console.log('Close the database connection.');
// });

function sendMessage(nm, message, rws) {
    rws.send(JSON.stringify({
        method: 'textMessage',
        params: {
            name: nm,
            msg: message
        }
    }));
}

// handlers

let handlers = {
    "set-background-color": function(m) {
        // ...
        console.log('[Client] set-background-color');
        console.log('[Client] Color is ' + m.params.color);
    },
    "textMessage": function(m, clients) {
        // console.log(`[${m.params.name}] ${m.params.msg}`);

        // Broadcast to everyone else connected
        clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(m));
            }
        });

        // Store message
        db.run(`INSERT INTO msgs(name, msg) VALUES(?, ?)`, [m.params.name, m.params.msg], function(err) {
            if (err) {
              return console.log(err.message);
            }
            // get the last insert id
            // console.log(`A row has been inserted with rowid ${this.lastID}`);
          });
    },
    "handshake": function(m, clients, ws) {
        console.log(`[Server] Received handshake from [${m.params.name}]: ${m.params.msg}`);
        let sql = `SELECT * FROM msgs`;
        let newClient = null;

        // Broadcast to everyone else connected
        clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN && client === ws) {
                newClient = client;
            }
        });



        db.all(sql, [], (err, rows) => {
            if (err) {
                throw err;
            }
            rows.forEach((row) => {
                console.log(`[${row.name}] ${row.msg}`);
                sendMessage(row.name, row.msg, newClient);
            });
        });
    }

};

function handleMessage(e, clients, ws) {

    if (e.method == undefined) {
        return;
    }

    let method = e.method;

    if (method) {
        if (handlers[method]) {
            let handler = handlers[method];
            handler(e, clients, ws);
        } else {
            console.log("[Server] Don't have a handler for that:" + method);
        }
    }

}