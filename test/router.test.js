/**
 * Created by Paul on 10/12/2014.
 */
var Router = require('wamp.rt');

var autobahn = require('autobahn');
var wamp = require('../src/rx.wamp');

//function onRPCRegistered(uri) {
//    console.log('onRPCRegistered RPC registered', uri);
//}
//
//function onRPCUnregistered(uri) {
//    console.log('onRPCUnregistered RPC unregistered', uri);
//}
//
//function onPublish(topicUri, args) {
//    console.log('onPublish Publish', topicUri, args);
//}
//
//var app = new Router({
//    port : 9000,
//    handleProtocols : function(protocols, cb) {
//        console.log(protocols);
//        cb(true, protocols[0]);
//    }
//});
//
//autobahn
//    .connectObservable({url : 'ws://localhost:9000', realm : 'realm1'})
//    .subscribe(function(session){
//        console.log('Got session');
//
//        session.callObservable("wamp.rt.foo", ["bar", "bar2"], {"key1": "bar1", "key2": "bar2"})
//            .subscribe(function(result){
//                console.log('Got result');
//            });
//
//        var topicSubscription = session.subscribeObservable("wamp.rt.bar").subscribe(function(){ console.log("Got published value");});
//
//
//        setTimeout(function(){ topicSubscription.dispose(); }, 5000);
//
//    });
//
//
//autobahn
//    .connectObservable({url : 'ws://localhost:9000', realm : 'realm1'})
//    .subscribe(function(session){
//
//        setInterval(function(){
//            session.publishObservable("wamp.rt.bar", [1, 2]);
//        }, 1000);
//
//    });
//
//app.on('RPCRegistered', onRPCRegistered);
//app.on('RPCUnregistered', onRPCUnregistered);
//app.on('Publish', onPublish);
//
//app.regrpc('wamp.rt.foo', function(id,args) {
//    console.log('called with ' + args);
//    app.resrpc(id,["bar", "bar2"], {"key1": "bar1", "key2": "bar2"});
//});
