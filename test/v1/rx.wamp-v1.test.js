/**
 * Created by paulp_000 on 12/25/2014.
 */
var when = require('when');
var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');

var autobahn = require('../../src/autobahn_v1');
var Rx = require('../../index')(autobahn);

var onNext = Rx.ReactiveTest.onNext;
var onError = Rx.ReactiveTest.onError;
var onCompleted = Rx.ReactiveTest.onCompleted;

describe("V1", function () {

    describe(".Connection", function () {

        var connector;
        var mock_connection;
        var test_scheduler;

        beforeEach(function () {


            test_scheduler = new Rx.TestScheduler();
        });

        it('should have an unrecognized version', function () {
            autobahn.version().should.equal("?.?.?");
        });


        it('should transparently use the same connection function', function () {

            var s = sinon.mock(new autobahn._connection_cls({url: 'ws://localhost:9000', realm: 'realm1'}));
            //sinon.stub(autobahn._connection_cls.prototype, "open", function(){
            //    this._onopen({});
            //});

            sinon.stub(s.object, "open", function () {
                this.onopen({});
            });

            connector = Rx.Observable.fromConnection({
                url: 'ws://localhost:9000', realm: 'realm1'
            }, null, function () {
                return s.object;
            });


            var results = test_scheduler.startWithCreate(function () {
                return connector;
            });

            results.messages.should.eql([onNext(200, {})]);
        });


    });

    describe(".Session", function () {

        var test_scheduler;
        var mock_session;


        beforeEach(function () {
            test_scheduler = new Rx.TestScheduler();
            mock_session = sinon.mock({
                publish: function () {
                },
                subscribe: function () {
                },
                unsubscribe: function () {
                },
                call: function () {
                }
            })
        });


        describe('#subscribeAsObservable', function () {

            it('should be able to subscribe to topics', function () {

                mock_session.expects("subscribe")
                    .once();

                var openObserver = test_scheduler.createObserver();

                var result = test_scheduler.startWithCreate(function () {
                    var subject = new Rx.Subject();

                    subject
                        .do(function () {
                            mock_session.expectations.subscribe[0].firstCall.args[1]("test.topic", 42);
                        })
                        .subscribe(openObserver);

                    return Rx.Observable.subscribeAsObservable(mock_session.object, "test.topic", null, subject);
                });

                mock_session.verify();
                result.messages.should.eql([onNext(200, {event: 42, topic: "test.topic"})]);

            });

        });

        describe('#publishAsObservable', function () {

            it('should be able to publish to topics', function () {

                mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42));
                mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42), sinon.match(true));
                mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42), sinon.match.array, sinon.match.array);


                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.merge(
                        Rx.Observable.publishAsObservable(mock_session.object, "test.topic", 42),
                        Rx.Observable.publishAsObservable(mock_session.object, "test.topic", 42, true),
                        Rx.Observable.publishAsObservable(mock_session.object, "test.topic", 42, [1234], [1234]));
                });

                mock_session.verify();

                result.messages.should.eql([onCompleted(200)]);
            });

        });

        describe('#callAsObservable', function () {

            it('should be able to call remote procedures', function(){

                mock_session.expects("call")
                    .withArgs(sinon.match("test.procedure"), sinon.match(42), sinon.match(0))
                    .returns(test_scheduler.createResolvedPromise(201, 42));

                var result = test_scheduler.startWithCreate(function(){
                    return Rx.Observable.callAsObservable(mock_session.object, "test.procedure")(42, 0);
                });

                mock_session.verify();
                result.messages.should.eql([onNext(201, 42), onCompleted(201)]);

            });
        });

    });

});