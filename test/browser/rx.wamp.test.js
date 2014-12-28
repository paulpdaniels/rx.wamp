/**
 * Created by paulp_000 on 12/27/2014.
 */
describe('a suite of tests', function(){

    var should = chai.should();

    describe('.Connection', function(){

        it('can connect to a server', function(done){
            this.timeout(10000);
            var subscription = Rx.Observable.fromConnection({url : "ws://localhost:9000"})
                .subscribe(function(session){
                    subscription.dispose();

                    //can be either depending on how fast we get here
                    session._websocket.readyState.should.be.within(2, 3);

                    done();
                });

        });

    });


});