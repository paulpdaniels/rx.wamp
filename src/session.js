/**
 * Created by Paul on 12/24/2014.
 */

observableStatic.fromSession = function(url, options) {

    return observableCreate(function(obs){

        function onopen() {
            obs.onNext(session);
        }

        function onhangup(code, reason) {
            if (code === CONNECTION_CLOSED)
                obs.onCompleted();
            else
                obs.onError(code, reason);
        }

        var session = new autobahn.Session(url, onopen, onhangup, options);

        return Disposable.create(function(){
            session.close();
        });
    });
};

observableStatic.authreqAsObservable = function(session, auth, authKey, extras) {

    return observablePromise(session.authreq(authKey, extras))
        .flatMap(function(challenge){
            return auth.call(session, challenge);
        });
};

observableStatic.fromPubSubPattern = function (session, topic, options, openObserver) {
    return new PubSubSubject(session, topic, options, openObserver);
};

var SubscriptionDisposable = (function(){

    var disposer = _isV2Supported() ?
        function(session, subscription) {
            session.unsubscribe(subscription)
        } :
        function(session, subscription) {
            session.unsubscribe(subscription.topic, subscription.handler);
        };

    function SubscriptionDisposable(session, subscriptionObservable) {

        this.session = session;
        this.subscription = null;
        var self = this;
        this.subscriptionSubscription = subscriptionObservable.subscribe(function(value){
            self.subscription = value;
        });

    }

    SubscriptionDisposable.prototype.dispose = function() {
        this.subscriptionSubscription.dispose();
        this.subscription && disposer.call(this, this.session, this.subscription);
    };

    return SubscriptionDisposable;
})();





observableStatic.subscribeAsObservable = function (sessionOrObservable, topic, options, openObserver) {
    var v2 = _isV2Supported();
    return observableStatic.create(function (obs) {

        var handler = !v2 ?
            function (topic, event) {
                obs.onNext({topic: topic, event: event});
            } :
            function (args, kwargs, details) {

                var next = {};
                args && (next.args = args);
                kwargs && (next.kwargs = kwargs);
                details && (next.details = details);

                obs.onNext(next);
            };

        //FIXME Since we overlap function names, can't use the usual method to determine if something is an observable so add a random function to the check
        sessionOrObservable.subscribe && sessionOrObservable.unsubscribe && (sessionOrObservable = observableStatic.just(sessionOrObservable));

        var subscriptionObservable = sessionOrObservable
            .flatMapLatest(function(session){
                var subscription = session.subscribe(topic, handler, options) || {topic : topic, handler : handler},
                    innerObservable = v2 ? observablePromise(subscription) : observableStatic.just(subscription);

                return Rx.Observable.create(function(innerObserver) {
                    return new CompositeDisposable(
                        new SubscriptionDisposable(session, innerObservable),
                        innerObservable.subscribe(innerObserver.onNext.bind(innerObserver)));
                });
            });

        return subscriptionObservable.subscribe(openObserver);
    });
};

observableStatic.publishAsObservable = function (session, topic, args, kwargs, options) {
    //FIXME apparently we are not supposed to use the Array.prototype.slice work around to get values of the argument object
    var published = session.publish.apply(session, Array.prototype.slice.call(arguments, 1));
    return published ? observablePromise(published) : observableEmpty();
};

var RegistrationDisposable = (function(){

    function RegistrationDisposable(session, registrationObservable){
        this.session = session;
        this.registration = null;
        var self = this;
        this.subscription = registrationObservable.subscribe(function(reg){
            self.registration = reg;
        });
    }

    RegistrationDisposable.prototype.dispose = function() {
        this.subscription.dispose();
        this.registration && this.session.unregister(this.registration);
    };

    return RegistrationDisposable;

})();

observableStatic.registerAsObservable = function (sessionOrObservable, procedure, endpoint, options) {

    return observableStatic.create(function (obs) {

        sessionOrObservable.unregister && sessionOrObservable.register && (sessionOrObservable = observableStatic.just(sessionOrObservable));

        var registrationObservable = sessionOrObservable
            .flatMapLatest(function(session){

                var registration = session.register(procedure, endpoint, options),
                    innerObservable = observablePromise(registration);

                return observableCreate(function(innerObserver){
                    return new CompositeDisposable(
                        //TODO Currently order is very important here, if this is flipped this won't work
                        new RegistrationDisposable(session, innerObservable),
                        innerObservable.subscribe(innerObserver.onNext.bind(innerObserver))

                    );
                });

            });

        return registrationObservable.subscribe(obs);
    });
};

observableStatic.callAsObservable = function (session, procedure, options) {
    var args = [procedure];
    return function () {
        args = args.concat(Array.prototype.slice.call(arguments));
        if (options) args.push(options);
        return observablePromise(session.call.apply(session, args));
    };
};