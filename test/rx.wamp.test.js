/**
 * Created by Paul on 10/13/2014.
 */

var Rx = require('rx');
var wamp = require('../index');
var chai = require('chai');
var should = chai.should();
var autobahn = require('autobahn');
var sinon = require('sinon');

describe('Wamp', function () {

    var router;
    var connector;
    var mock_session;
    var stub_connection;

    before(function() {
        mock_session = sinon.stub();

        stub_connection = sinon.stub(autobahn.Connection.prototype, "open", function(){
            this.onopen(mock_session);
        });
    });

    afterEach(function(){
        stub_connection.restore();
    });

    describe('#connectObservable', function () {

        beforeEach(function () {
            connector = Rx.Observable.fromConnection({
                url: 'ws://localhost:9000', realm: 'realm1'
            });
        });

        it('should return a new session object onNext', function (done) {

            connector
                .subscribe(function (session) {
                    session.should.equal(mock_session);
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

            Rx.Observable.fromConnection({url: "ws://localhost:9001", realm: 'realm1'})
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
        var sessionSubject = new Rx.BehaviorSubject();
        var testScheduler = new Rx.TestScheduler();

        beforeEach(function () {

            var stub_socket = sinon.stub();
            var stub_defer = sinon.stub();

            new autobahn.Session(stub_socket, stub_defer);

        });

        describe('#subscribeAsObservable', function () {

            it("should be able to subscribe to topics", function () {



                //sessionSubject.subscribe(function(session) {
                //    session.subscribeAsObservable("wamp.io.test");
                //    done();
                //});

            });

            it("should be handle concatenation gracefully", function (done) {
                var subscription = client
                    .subscribeAsObservable("wamp.io.test2")
                    .concatAll()
                    .subscribe(function (value) {
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
            })
        });

        describe("#registerAsObservable", function () {

            it('should be able to register for topics', function (done) {
                client.registerAsObservable('wamp.io.add', function (args, kwargs, options) {
                    return args[0] + args[1];
                }).subscribe(function () {

                });
            })
        });

        describe("#publishObservable", function () {

            it('should be able to publish to topics', function (done) {
                client.publishAsObservable('wamp.io.test', [1, 2], {test: "test"});
            });

        });

        describe("#callAsObservable", function () {

            it('should be able to call remote methods', function (done) {

                var caller = client.callAsObservable("wamp.io.add");

                caller([1, 2], {})
                    .subscribe(function (value) {
                        value.args[0].should.equal(3);
                        done();
                    }, done);

            })

        });

        describe("#advanced", function () {

            it("should handle pipelined actions", function (done) {

                var adder = client.callAsObservable("wamp.my.add");
                var multiplier = client.callAsObservable("wamp.my.multiply");

                var pipeline =
                    Rx.Observable.zip(adder([2, 3]), adder([3, 4]),
                        function (value1, value2) {
                            return [value1, value2];
                        })

                        .flatMap(function (value) {
                            return multiplier(value);
                        });

                pipeline.subscribe(function (value) {
                    try {
                        value.should.equal(35);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, done)


            });

        })

    });
});