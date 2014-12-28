/**
 * Created by paulp_000 on 12/27/2014.
 */
describe('WAMP version 1', function(){

    var should = chai.should();

    describe('.Connection', function(){

        it('can connect to a server', function(done){
            this.timeout(5000);
            var subscription = Rx.Observable.fromConnection({url : "ws://localhost:9000"})
                .subscribe(function(session){
                    subscription.dispose();

                    //can be either depending on how fast we get here
                    session._websocket.readyState.should.be.within(2, 3);

                    done();
                }, done);
        });

    });

    describe('.Session', function(){

        var session = null;
        var connection = null;

        before(function(done){
            connection = Rx.Observable.fromConnection({url : "ws://localhost:9000"})
                .subscribe(function(sess) {session = sess; done();});
        });

        it('should be able to subscribe to methods', function(done) {
            Rx.Observable.subscribeAsObservable(session, "topic.something")
                .subscribe(function(value){
                    done();
                });
            session.publish("topic.something", 42, false);
        });

        it('should be able to unsubscribe from methods', function(done) {

            this.timeout(5000);

            var id = setTimeout(done, 2000);

            var subscription = Rx.Observable.subscribeAsObservable(session, "topic.something")
                .subscribe(function(value){
                    clearTimeout(id);
                    fail("Should not execute this function");
                });

            subscription.dispose();

            session.publish("topic.something", 42, false);

            //if it gets here and never executes then we can assume the unsubscribe worked

        });

        it('should be able to call procedures');

    })


});