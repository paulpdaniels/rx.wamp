/**
 * Created by Paul on 12/24/2014.
 */

observableWamp.fromSession = observableStatic.fromSession = function(url, options) {

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

/**
 * Authenticates the session and returns a value when the authentication has completed
 *
 * @param session
 * @param {Function} auth - Authentication function to call, this is the session
 * @param {String} authKey - The key to passe to the server to initiate authentication
 * @param {Object} extras - Passes optional extras to the authentication
 * @returns {Rx.Observable<TResult>|*}
 */
observableWamp.authreqAsObservable = observableStatic.authreqAsObservable = function(session, auth, authKey, extras) {

    return observablePromise(session.authreq(authKey, extras))
        .flatMap(function(challenge){
            return auth.call(session, challenge);
        });
};

/**
 *
 * @type {Function}
 */
observableWamp.fromPubSubPattern = observableStatic.fromPubSubPattern = function (session, topic, options, openObserver) {
    return new PubSubSubject(session, topic, options, openObserver);
};

var SubscriptionDisposable = (function(){

    function SubscriptionDisposable(session, subscriber, disposer) {
        this.session = session;
        this.disposer = disposer;
        this.subscription = null;
        var self = this;
        this.subscriptionSubscription =
            subscriber(
                observerCreate(
                    function(value) {
                        self.subscription = value;

                    },
                    function(e) {
                        self.dispose();
                    }));
    }

    Rx.internals.addProperties(SubscriptionDisposable.prototype, {

        dispose : function() {
            this.subscriptionSubscription && this.subscriptionSubscription.dispose();
            this.subscription && this.disposer.call(this, this.session, this.subscription);
        }
    });

    return SubscriptionDisposable;
})();

var TopicDisposable = (function(__super__){

    var disposer = _isV2Supported() ?
        function(session, subscription) {
            session.unsubscribe(subscription)
        } :
        function(session, subscription) {
            session.unsubscribe(subscription.topic, subscription.handler);
        };

    function TopicDisposable(session, subscriptionObservable) {

        __super__.call(this, session,
            function(observer){ return subscriptionObservable.subscribe(observer);},
            disposer);
    }

    Rx.internals.inherits(TopicDisposable, SubscriptionDisposable);

    return TopicDisposable;
})(SubscriptionDisposable);

var RegistrationDisposable = (function(__super__){

    function RegistrationDisposable(session, registrationObservable){
        __super__.call(this, session,
            function(observer) { return registrationObservable.subscribe(observer);},
            function(session, subscription) { session.unregister(subscription);}
        );
    }

    Rx.internals.inherits(RegistrationDisposable, __super__);

    return RegistrationDisposable;

})(SubscriptionDisposable);


/**
 *
 * @param sessionOrObservable
 * @param topic
 * @param options
 * @param openObserver
 */
observableWamp.subscribeAsObservable = observableStatic.subscribeAsObservable = function subscribeAsObservable(sessionOrObservable, topic, options, openObserver) {
    var v2 = _isV2Supported();
    return observableCreate(function (obs) {

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

        //TODO use a connectable observable to turn on and of the subscription? Instead of sending it to an optional argument
        var subscriptionObservable = sessionOrObservable
            .flatMapLatest(function(session){
                var subscription = session.subscribe(topic, handler, options) || {topic : topic, handler : handler},
                    innerObservable = v2 ? observablePromise(subscription) : observableStatic.just(subscription);

                return observableCreate(function(innerObserver) {
                    return new CompositeDisposable(
                        new TopicDisposable(session, innerObservable),
                        innerObservable.subscribe(
                            innerObserver.onNext.bind(innerObserver),
                            innerObserver.onError.bind(innerObserver)));
                });
            });

        return subscriptionObservable.subscribe(openObserver, obs.onError.bind(obs));
    });
};

observableWamp.publishAsObservable = observableStatic.publishAsObservable = function (session, topic, args, kwargs, options) {
    //FIXME apparently we are not supposed to use the Array.prototype.slice work around to get values of the argument object
    var largs = [], len = arguments.length;
    //Call this with everything *BUT* the session which will always be the first argument
    for (var i = 1; i < len; ++i) largs.push(arguments[i]);
    var published = session.publish.apply(session, largs);
    return published ? observablePromise(published) : observableEmpty();
};

observableWamp.registerAsObservable = observableStatic.registerAsObservable = function (sessionOrObservable, procedure, endpoint, options) {

    return observableCreate(function (obs) {

        sessionOrObservable.unregister && sessionOrObservable.register && (sessionOrObservable = observableStatic.just(sessionOrObservable));

        var registrationObservable = sessionOrObservable
            .flatMapLatest(function(session){

                var registration = session.register(procedure, endpoint, options),
                    innerObservable = observablePromise(registration);

                return observableCreate(function(innerObserver){
                    return new CompositeDisposable(
                        //TODO Currently order is very important here, if this is flipped this won't work
                        new RegistrationDisposable(session, innerObservable),
                        innerObservable.subscribe(innerObserver.onNext.bind(innerObserver), innerObserver.onError.bind(innerObserver))
                    );
                });

            });

        return registrationObservable.subscribe(obs);
    });
};

observableWamp.callAsObservable = observableStatic.callAsObservable = function (session, procedure, options) {

    return function () {
        var args = [procedure], len = arguments.length;
        for (var i = 0; i < len; ++i) args.push(arguments[i]);
        options && args.push(options);
        return observablePromise(session.call.apply(session, args));
    };
};