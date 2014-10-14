/**
 * Created by Paul on 10/13/2014.
 */

var Rx = require('rx');
var wamp = require('../index');
var chai = require('chai');
var should = chai.should();
var autobahn = require('autobahn');
var Router = require('wamp.rt');

describe('Wamp', function () {

    var router;
    var connector;

    before(function () {

        router = new Router({port: 9000
        });
    });

    beforeEach(function () {
        connector = autobahn.connectObservable({url: 'ws://localhost:9000', realm: 'realm1'});
    });

    describe('#connectObservable', function () {

        it('should return a new session object onNext', function (done) {

            connector
                .subscribe(function () {
                    done();
                },
                done);
        });

        it('should not raise onComplete when unsubscribed', function () {

            var subscription = connector.subscribeOnCompleted(function () {
                fail();
            });

            subscription.dispose();


        });

        it('should propagate an exception if a connection cannot be established', function (done) {

            autobahn.connectObservable({url: "ws://localhost:9001", realm: 'realm1'})
                .subscribe(function () {
                    done(new Error("No return value expected"));
                }, function (e) {
                    done();
                }, function () {
                    done(new Error("should not complete"));
                });
        });

    });

    describe(".clients", function () {

        var client;

        beforeEach(function (done) {
            connector.subscribe(function (session) {
                client = session;
                done();
            });
        });

        describe('#subscribeObservable', function () {


            it("should be able to subscribe to topics", function (done) {

                client
                    .subscribeObservable("wamp.io.test")
                    .subscribe(function(topic){

                        var subscription = topic.subscribe(function(value){
                            try {
                                value.args[0].should.equal(1);
                                value.args[1].should.equal(2);
                            } catch (e) {
                                done(e);
                                return;
                            }

                            subscription.dispose();
                            done();
                        });

                        router.publish("wamp.io.test", 0, [1, 2], {test : "test"});


                    });

            });
        });

        describe("#registerObservable", function () {

            it('should be able to register for topics', function (done) {
                client.registerObservable('wamp.io.add', function (args, kwargs, options) {
                    return args[0] + args[1];
                }).subscribe(function(){
                    router.callrpc('wamp.io.add', [[1, 2]], function(args){
                        try {
                            args[0][0].should.equal(3);
                        } catch (e) {
                            done(e);
                            return;
                        }

                        done();

                    });
                });


            })

        });

        describe("#publishObservable", function () {

            afterEach(function(){
                router.unsubstopic("wamp.io.test", 5);
            });


            it('should be able to publish to topics', function (done) {

                router.substopic("wamp.io.test", 5, function(id, args, kwargs){
                    try {
                        args[0].should.equal(1);
                        args[1].should.equal(2);
                        kwargs.should.have.property("test");
                        kwargs.test.should.equal("test");
                    } catch (e) {
                        done(e);
                        return;
                    }

                    done();
                });

                client.publishObservable('wamp.io.test', [1, 2], {test : "test"});
            });

        });

        describe("#callObservable", function () {

            beforeEach(function(done){

                router.on("RPCRegistered", function(){done();});

                router.regrpc("wamp.io.add", function(id, args){
                    var kwargs = args[1];
                    args = args[0];

                    router.resrpc(id, [[args[0] + args[1]], {test : -1}]);

                });

            });

            afterEach(function(){

                router.unregrpc("wamp.io.add");

            });

            it('should be able to call remote methods', function (done) {

                client.callObservable('wamp.io.add', [1, 2], {})
                    .subscribe(function(value) {
                        value.args[0].should.equal(3);
                        done();
                    }, done);

            })

        });

    });


});