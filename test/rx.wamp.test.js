/**
 * Created by Paul on 10/13/2014.
 */

var Rx = require('rx');
var wamp = require('../index');
var chai = require('chai');
var should = chai.should();
var autobahn = require('autobahn');
var sinon = require('sinon');
var asPromised = require('sinon-as-promised');


var onNext = Rx.ReactiveTest.onNext,
    onCompleted = Rx.ReactiveTest.onCompleted,
    onError = Rx.ReactiveTest.onError;

describe('Wamp', function () {

    describe('#fromConnection', function () {

        var connector;
        var mock_session;
        var stub_connection;

        before(function () {
            mock_session = sinon.stub();

            stub_connection = sinon.stub(autobahn.Connection.prototype, "open", function () {
                this.onopen(mock_session);
            });
        });

        afterEach(function () {
            stub_connection.restore();
        });

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

    describe(".Session", function () {

        var client;
        var testScheduler;
        var mock_session, mock_subscription, mock_registration, mock_publish, mock_call;
        var sample_data = {args: [42], kwargs: {key: 'value'}};

        beforeEach(function () {

            mock_subscription = sinon.stub().resolves({});
            mock_registration = sinon.stub().resolves({});
            mock_publish = sinon.stub().resolves({});
            mock_call = sinon.stub().resolves(sample_data);
            testScheduler = new Rx.TestScheduler();

            mock_session = sinon.mock({
                subscribe: function (topic, handler, options) {
                    handler([1, 2], {key: "value"});
                    return testScheduler.createResolvedPromise(201, {});
                },
                unsubscribe: function () {

                },
                publish: function () {
                    return testScheduler.createResolvedPromise(201, {});
                },
                register: function () {
                    return testScheduler.createResolvedPromise(201, {});
                },
                unregister: function () {
                },
                call: function () {
                    return testScheduler.createResolvedPromise(201, sample_data);
                }
            });


        });

        describe('#subscribeAsObservable', function () {

            it("should be able to subscribe to topics", function () {
                Rx.Observable.subscribeAsObservable(mock_session.object, "wamp.io.test");
            });

            it("should be handle concatenation gracefully", function (done) {
                var subscription = Rx.Observable
                    .subscribeAsObservable(mock_session.object, "wamp.io.test2")
                    .subscribe(function (value) {
                        try {
                            value.args[0].should.equal(1);
                            value.args[1].should.equal(2);
                        } catch (e) {
                            done(e);
                            return;
                        }
                        done();
                    });
            })
        });

        describe("#registerAsObservable", function () {

            it('should be able to register for topics', function () {

                var result = testScheduler.startWithCreate(function(){
                    return Rx.Observable.registerAsObservable(mock_session.object, 'wamp.io.add', function (args, kwargs, options) {
                        return args[0] + args[1];
                    });
                });

                result.messages.should.eql([onNext(201, {}), onCompleted(201)]);

            })
        });

        describe("#publishObservable", function () {

            it('should be able to publish to topics', function () {

                var result = testScheduler.startWithCreate(function() {
                    return Rx.Observable.publishAsObservable(mock_session.object, 'wamp.io.test', [1, 2], {test: "test"});
                });

                result.messages.should.eql([onNext(201, {}), onCompleted(201)]);

            });

        });

        describe("#callAsObservable", function () {

            it('should be able to call remote methods', function () {


                var result = testScheduler.startWithCreate(function () {
                    return Rx.Observable.callAsObservable(mock_session.object, "wamp.io.add")([1, 2], {});
                });

                result.messages.length.should.equal(2);
                result.messages.should.eql([onNext(201, sample_data), onCompleted(201)]);
            })

        });

        describe("#advanced", function () {

            it("should handle pipelined actions", function () {

                var result = testScheduler.startWithCreate(function () {
                    var adder = Rx.Observable.callAsObservable(mock_session.object, "wamp.my.add");
                    var multiplier = Rx.Observable.callAsObservable(mock_session.object, "wamp.my.multiply");

                    return Rx.Observable.zip(adder([2, 3]), adder([3, 4]),
                        function (value1, value2) {
                            return [value1, value2];
                        })

                        .flatMap(function (value) {
                            return multiplier(value);
                        });
                });

                result.messages.length.should.equal(2);

                //
                //pipeline.subscribe(function (value) {
                //    try {
                //        value.should.equal(sample_data);
                //        done();
                //    } catch (e) {
                //        done(e);
                //    }
                //}, done)
            });

        })

    });
});