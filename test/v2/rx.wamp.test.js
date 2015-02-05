/**
 * Created by Paul on 10/13/2014.
 */

var chai = require('chai');
var should = chai.should();
var autobahn = require('autobahn');
var Rx = Object.create(require('../../index')(autobahn));
var sinon = require('sinon');
var asPromised = require('sinon-as-promised');


var onNext = Rx.ReactiveTest.onNext,
    onCompleted = Rx.ReactiveTest.onCompleted,
    onError = Rx.ReactiveTest.onError;

describe('V2', function () {

    describe('#fromConnection', function () {

        var connector;
        var mock_session;
        var mock_connection;
        var stub_connection;
        var test_scheduler;

        before(function () {
            mock_session = sinon.mock({
                close: function () {
                }
            });

            mock_connection = sinon.mock({
                open: function () {
                    this.onopen(mock_session.object);
                },
                close: function () {
                    this.onclose();
                },
                onopen: null,
                onclose: null
            });

            stub_connection = sinon.stub(autobahn.Connection.prototype, "open", function () {
                this.onopen(mock_session);
            });

            connector = Rx.Observable.fromConnection({
                url: 'ws://localhost:9000', realm: 'realm1'
            }, null, function () {
                return mock_connection.object;
            });
        });

        afterEach(function () {
            stub_connection.restore();
        });

        beforeEach(function () {

            mock_connection.restore();

            test_scheduler = new Rx.TestScheduler();
        });

        it('should return a new session object onNext', function () {

            var results = test_scheduler.startWithCreate(function () {
                return connector;
            });

            results.messages.should.eql([onNext(200, mock_session.object)]);
        });


        it('should disconnect session on unsubscribe', function () {

            mock_connection.expects("close").once();

            var result = test_scheduler.startWithCreate(function () {
                return connector;
            });

            mock_connection.verify();
        });


        it('should propagate an exception if a connection cannot be established', function () {

            var error = new Error();
            sinon.stub(mock_connection.object, "open").throws(error);

            var result = test_scheduler.startWithCreate(function () {
                return connector;
            });

            result.messages.should.eql([onError(200, error)]);


        });

    });

    describe(".Session", function () {

        var test_scheduler;
        var mock_session;
        var sample_data = {args: [42], kwargs: {key: 'value'}};

        beforeEach(function () {

            test_scheduler = new Rx.TestScheduler();

            mock_session = sinon.mock({
                subscribe: function (topic, handler, options) {
                    handler([1, 2], {key: "value"});
                    return test_scheduler.createResolvedPromise(201, {});
                },
                unsubscribe: function () {

                },
                publish: function () {
                    return test_scheduler.createResolvedPromise(201, {});
                },
                register: function () {
                    return test_scheduler.createResolvedPromise(201, {});
                },
                unregister: function () {
                },
                call: function () {
                    return test_scheduler.createResolvedPromise(201, sample_data);
                }
            });


        });

        describe('#subscribeAsObservable', function () {

            it("should be able to subscribe to topics", function () {

                mock_session.expects("subscribe")
                    .once()
                    .withArgs(sinon.match("wamp.io.test"))
                    .returns(test_scheduler.createResolvedPromise(201, {}));

                mock_session.expects("unsubscribe")
                    .once();

                var openObserver = test_scheduler.createObserver();
                var results = test_scheduler.startWithCreate(function () {

                    var subject = new Rx.Subject();

                    subject
                        .tap(function () {
                            mock_session.expectations.subscribe[0].firstCall.args[1]([42], {key: "value"});
                        })
                        .subscribe(openObserver);

                    return Rx.Observable.subscribeAsObservable(mock_session.object, "wamp.io.test", {}, subject);
                });

                openObserver.messages.should.eql([onNext(201, {})]);
                results.messages.should.eql([onNext(201, sample_data)]);
                mock_session.verify();

            });
        });

        describe("#registerAsObservable", function () {

            it('should be able to register for topics', function () {

                var promise = test_scheduler.createResolvedPromise(201, {args : [42]});

                mock_session.expects("register")
                    .once()
                    .withArgs(sinon.match("wamp.io.add"), sinon.match.func)
                    .returns(promise);

                mock_session.expects("unregister")
                    .once()
                    .withArgs(sinon.match({args : [42]}));

                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.registerAsObservable(mock_session.object, 'wamp.io.add', function (args, kwargs, options) {
                        return args[0] + args[1];
                    });
                });

                result.messages.should.eql([onNext(201, {args : [42]})]);
                mock_session.verify();

            })
        });

        describe("#publishObservable", function () {

            it('should be able to publish to topics', function () {

                mock_session.expects("publish")
                    .once()
                    .withArgs(sinon.match('wamp.io.test'), sinon.match.array, sinon.match.object)
                    .returns(test_scheduler.createResolvedPromise(201, {}));


                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.publishAsObservable(mock_session.object, 'wamp.io.test', [1, 2], {test: "test"});
                });

                result.messages.should.eql([onNext(201, {}), onCompleted(201)]);
                mock_session.verify();
            });

        });

        describe('#pubsub', function () {

            it('should be able to subscribe', function () {
                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.fromPubSubPattern(mock_session.object, 'wamp.io.test');
                });

                result.messages.should.eql([onNext(200, {
                    "args": [
                        1,
                        2
                    ],
                    "kwargs": {
                        "key": "value"
                    }
                })]);
            });

            it('should be able to publish', function () {
                var result = test_scheduler.createObserver();

                mock_session.expects("publish")
                    .once()
                    .withArgs(sinon.match("wamp.io.test"), sinon.match([42]), sinon.match({key : "value"}));

                var subject = Rx.Observable.fromPubSubPattern(mock_session.object, 'wamp.io.test');

                subject
                    .observeOn(test_scheduler)
                    .subscribeOn(test_scheduler)
                    .subscribe(result);

                subject.onNext({args: [42], kwargs: {key: "value"}});

                result.messages.should.eql([]);
                mock_session.verify();
            });

            it('should be able to surface errors in publishing', function () {

                mock_session.expects("publish")
                    .once()
                    .returns(test_scheduler.createRejectedPromise(201, new Error("no pubsub")));

                var result = test_scheduler.startWithCreate(function () {
                    var subject = Rx.Observable.fromPubSubPattern(mock_session.object, 'wamp.io.test');
                    subject.onNext({args : [42]});
                    return subject.errors;
                });

                result.messages.should.eql([onNext(201, new Error("no pubsub"))]);

            });

        });

        describe("#callAsObservable", function () {

            it('should be able to call remote methods', function () {

                mock_session.expects("call")
                    .once()
                    .withArgs(sinon.match("wamp.io.add"), sinon.match.array, sinon.match.object)
                    .returns(test_scheduler.createResolvedPromise(201, sample_data));

                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.callAsObservable(mock_session.object, "wamp.io.add")([1, 2], {});
                });

                result.messages.length.should.equal(2);
                result.messages.should.eql([onNext(201, sample_data), onCompleted(201)]);
                mock_session.verify();
            })

        });

        describe("#advanced", function () {

            it("should handle pipelined actions", function () {

                mock_session
                    .expects("call")
                    .thrice()
                    .onFirstCall().returns(test_scheduler.createResolvedPromise(203, 5))
                    .onSecondCall().returns(test_scheduler.createResolvedPromise(203, 7))
                    .onThirdCall().returns(test_scheduler.createResolvedPromise(203, 35));

                var result = test_scheduler.startWithCreate(function () {
                    var add = Rx.Observable.callAsObservable(mock_session.object, "wamp.my.add");
                    var multiply = Rx.Observable.callAsObservable(mock_session.object, "wamp.my.multiply");

                    return Rx.Observable.zip(add([2, 3]), add([3, 4]),
                        function (value1, value2) {
                            return [value1, value2];
                        })

                        .flatMap(function (value) {
                            return multiply(value);
                        });
                });

                mock_session.verify();
                result.messages.should.eql([onNext(203, 35), onCompleted(203)]);

            });

        })

    });
});