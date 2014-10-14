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

        router = new Router({port: 9000,
            handleProtocols: function (protocols, cb) {
                console.log(protocols);
                cb(true, protocols[0]);
            }
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

            it("should be able to subscribe to topics", function () {

                client.subscribeObservable("wamp.io.test");

            });
        });

        describe("#registerObservable", function () {

            it('should be able to register for topics', function(){
                client.registerObservable('wamp.io.add', function(args, kwargs, options){});
            })

        });

        describe("#publishObservable", function () {

            it('should be able to publish to topics', function(){
                client.publishObservable('wamp.io.test',[1, 2], {});
            });

        });

        describe("#callObservable", function () {

            it('should be able to call remote methods', function(){

                client.callObservable('wamp.io.add', [1, 2], {});

            })

        });

    });



});