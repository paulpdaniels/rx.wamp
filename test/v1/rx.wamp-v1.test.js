/**
 * Created by paulp_000 on 12/25/2014.
 */
var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');

var autobahn = require('./autobahn_v1');
var Rx = require('../../index')(autobahn);

var onNext = Rx.ReactiveTest.onNext;
var onError = Rx.ReactiveTest.onError;
var onCompleted = Rx.ReactiveTest.onCompleted;
var subscribe = Rx.ReactiveTest.subscribe;

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
                },
                authreq : function() {
                },
                auth : function(){},
                authsign : function(){}
            })
        });

        describe('#fromSession', function(){

            var mockWebSocket;
            var spied;
            beforeEach(function(){

                mockWebSocket = sinon.mock({});
                sinon.spy(autobahn, 'Session');
                sinon.stub(autobahn, '_construct').returns(mockWebSocket.object);
            });

            afterEach(function() {
                autobahn.Session.restore();
            });

            it('should complete on close', function(){

                var testObserver = test_scheduler.createObserver();

                Rx.Observable.fromSession('ws://fake-url.com').subscribe(testObserver);

                mockWebSocket.object.onmessage({ data : '[0, "someid", 1, "fake-server"]'});

                test_scheduler.start();

                testObserver.messages.length.should.equal(1);
                testObserver.messages[0].value.value.should.have.property("_server", "fake-server");
                testObserver.messages[0].value.value.should.have.property("_session_id", "someid");
                testObserver.messages[0].value.value.should.have.property("_websocket", mockWebSocket.object);
            });


            it('should propogate an error on failed close');
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

            it('should only create one subscription per call', function() {

                mock_session.expects("subscribe")
                    .once();

                var topic = Rx.WAMP.subscribeAsObservable(mock_session.object, "test.topic", null);

                topic.subscribe();
                topic.subscribe();

                mock_session.verify();


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

            it ('should propagate an error from subscription', function() {

                //mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42));
                //mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42), sinon.match(true));
                //mock_session.expects("publish").withArgs(sinon.match("test.topic"), sinon.match(42), sinon.match.array, sinon.match.array);


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

            it('should be able to call remote procedures', function () {

                mock_session.expects("call")
                    .withArgs(sinon.match("test.procedure"), sinon.match(42), sinon.match(0))
                    .returns(test_scheduler.createResolvedPromise(201, 42));

                var result = test_scheduler.startWithCreate(function () {
                    return Rx.Observable.callAsObservable(mock_session.object, "test.procedure")(42, 0);
                });

                mock_session.verify();
                result.messages.should.eql([onNext(201, 42), onCompleted(201)]);

            });
        });

        describe('#authentication', function(){


            it('should authenticate', function(){

                mock_session
                    .expects('authreq')
                    .once()
                    .withArgs(sinon.match('blahblah'), sinon.match.object)
                    .returns(test_scheduler.createResolvedPromise(201, 42));

                mock_session
                    .expects('auth')
                    .once()
                    .withArgs(sinon.match('the answer'))
                    .returns(test_scheduler.createResolvedPromise(202, 'authenticated!'));

                mock_session
                    .expects('authsign')
                    .once()
                    .returns('the answer');

                var results = test_scheduler.startWithCreate(function() {
                    return Rx.Observable.authreqAsObservable(mock_session.object,
                        function (challenge) {
                            var signature = this.authsign(challenge, "");
                            return this.auth(signature);
                        },
                        "blahblah",
                        {}
                    );
                });

                mock_session.verify();
                results.messages.should.eql([onNext(202, 'authenticated!'), onCompleted(202)]);
            });
        });

        describe('#subscribeTo', function(){

            it('should support multiple subscriptions', function() {

                var scheduler = new Rx.TestScheduler();

                var xs = scheduler.createHotObservable(
                    onNext(210, mock_session.object)
                );

                mock_session.expects('subscribe')
                    .twice();

                var results = scheduler.createObserver();

                var subscription =
                    Rx.WAMP.subscriber(xs)
                    .to("test.pubsub1", {}, results)
                    .to("test.pubsub2", {}, results.onNext.bind(results));


                scheduler.scheduleAbsolute(220, function(){
                    subscription.dispose();
                });

                scheduler.start();

                mock_session.verify();

                xs.subscriptions.should.eql([subscribe(0, 220), subscribe(0, 220)]);
            });
        });

    });

});