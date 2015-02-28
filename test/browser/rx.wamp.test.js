/**
 * Created by paulp_000 on 12/27/2014.
 */
describe('WAMP version 1', function () {

    var should = chai.should();

    describe('.Connection', function () {

        it('can connect to a server', function (done) {
            this.timeout(5000);
            var subscription = Rx.Observable.fromConnection({url: "ws://localhost:9000"})
                .subscribe(function (session) {
                    subscription.dispose();

                    //can be either depending on how fast we get here
                    session._websocket.readyState.should.be.within(2, 3);

                    done();
                }, done);
        });

    });

    describe('.Session', function () {

        var session = null;
        var connection = null;

        before(function (done) {
            connection = Rx.Observable.fromConnection({url: "ws://localhost:9000"})
                .subscribe(function (sess) {
                    session = sess;
                    done();
                });
        });

        it('should be able to subscribe to methods', function (done) {

            this.timeout(5000);

            Rx.Observable.subscribeAsObservable(session, "topic.something")
                .subscribe(function (value) {
                    done();
                });
            session.publish("topic.something", 42, false);
        });

        it('should unsubscribe on dispose', function (done) {

            this.timeout(5000);

            //if it gets here and never executes then we can assume the unsubscribe worked
            var id = setTimeout(done, 2000);

            var subscription = Rx.Observable.subscribeAsObservable(session, "topic.something")
                .subscribe(function (value) {
                    //we didn't unsubscribe like we were supposed to
                    clearTimeout(id);
                    fail("Should not execute this function");
                });

            subscription.dispose();

            session.publish("topic.something", 42, false);
        });

        it('should be able to call procedures', function (done) {
            var caller = Rx.Observable.callAsObservable(session, "test.add.procedure");

            var result = caller(29, 13);

            result.subscribe(function (value) {
                value.should.equal(42);
                done();
            }, done);
        });

        it('should surface call errors through the error callback', function (done) {
            var caller = Rx.Observable.callAsObservable(session, "test.blah.procedure");

            var result = caller(12, 13);

            result.subscribe(function () {
                done(new Error("Should not complete"));
            }, function () {
                done();
            });
        })

    })


});