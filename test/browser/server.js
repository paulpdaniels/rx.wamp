/**
 * Created by paulp_000 on 12/27/2014.
 */
var wamp = require('wamp.io-mirror');
var WebSocketServer = require('../../node_modules/wamp.io-mirror/node_modules/ws/index').Server;

var server = wamp.attach(new WebSocketServer({port:9000}));

server.on('clientconnected', function(){
    console.log("client connected");
});

server.on('clientdisconnected', function(){
    console.log("client disconnected");
});

server.on('call', function(proc, args, cb){

    if (proc === "test.add.procedure")
        cb(null, args[0] + args[1]);
    else
        cb(new Error("no existing method"));

});