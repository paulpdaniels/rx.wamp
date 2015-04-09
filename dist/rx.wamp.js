;(function (factory) {
    var objectTypes = {
        'boolean': false,
        'function': true,
        'object': true,
        'number': false,
        'string': false,
        'undefined': false
    };

    var root = (objectTypes[typeof window] && window) || this,
        freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports,
        freeModule = objectTypes[typeof module] && module && !module.nodeType && module,
        moduleExports = freeModule && freeModule.exports === freeExports && freeExports,
        freeGlobal = objectTypes[typeof global] && global;

    if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
        root = freeGlobal;
    }

    // Because of build optimizers
    if (typeof define === 'function' && define.amd) {
        define(['rx', 'autobahn', 'exports'], function (Rx, autobahn, exports) {
            root.Rx = factory(root, exports, Rx, autobahn);
            return root.Rx;
        });
    } else if (typeof module === 'object' && module && module.exports === freeExports) {
        module.exports = function(wamp){
            if (!wamp)
                wamp = require('autobahn');

            return factory(root, module.exports, require('rx'), wamp);
        }
    } else {
        root.Rx = factory(root, {}, root.Rx, root.autobahn);
    }
}.call(this, function (root, exp, Rx, autobahn, undefined) {


var observableStatic = Rx.Observable,
    observableWamp = Rx.WAMP = {},
    observableEmpty = observableStatic.empty,
    observableCreate = observableStatic.create,
    observablePromise = observableStatic.fromPromise,
    observerStatic = Rx.Observer,
    observerCreate = observerStatic.create,
    Subject = Rx.Subject,
    Disposable = Rx.Disposable,
    CompositeDisposable = Rx.CompositeDisposable,
    SerialDisposable = Rx.SerialDisposable,
    autobahn = autobahn || ab,
    sessionProto = autobahn.Session.prototype,
    isObservable = function(obs) { return obs && typeof obs.subscribe === 'function';},
    isPromise = Rx.helpers.isPromise,
    noop = Rx.helpers.noop;

var _detectVersion = function() {
    return (typeof autobahn.version !== 'function' || autobahn.version() !== "?.?.?" && !!autobahn.Connection) ? 2 : 1;
};

var __version = _detectVersion();

var CONNECTION_CLOSED = autobahn.CONNECTION_CLOSED || "closed",
    CONNECTION_UNREACHABLE = autobahn.CONNECTION_UNREACHABLE || "unreachable",
    CONNECTION_LOST = autobahn.CONNECTION_LOST || "lost";
/**
 * Created by Paul on 12/24/2014.
 */


autobahn._connection_cls = autobahn.Connection || function (opts) {

    var url;
    if (typeof opts === 'string') {
        url = opts;
        opts = {};
    } else if (typeof opts === 'object') {
        url = opts.uri || opts.url;
    } else {
        throw new Error('Wamp options must not be undefined or null!');
    }

    var disposable = new SerialDisposable();

    this._onopen = function (session) {

        disposable.setDisposable(Disposable.create(function () {
            session.close();
        }));

        if (!disposable.isDisposed && this.onopen)
            this.onopen(session);
    };

    this.open = function () {
        autobahn.connect(url, this._onopen.bind(this), this.onclose, opts);
    };

    this.close = function () {
        disposable.dispose();
    };

    this.onopen = null;
    this.onclose = null;

};

function _connection_factory(opts) {
    return new autobahn._connection_cls(opts);
}

observableWamp.fromConnection = observableStatic.fromConnection = function (opts, keepReconnecting, factory) {

    var isV2Supported = _detectVersion();



    var connection = (factory || _connection_factory)(opts);

    return observableStatic.create(function (obs) {

        connection.onopen = function (session) {
            obs.onNext(session);
        };

        connection.onclose = function (codeOrReason, reasonOrDetails, details) {

            var code = codeOrReason;
            var reason = isV2Supported ? code : reasonOrDetails;
            var details = isV2Supported ? reasonOrDetails : details;

            switch (codeOrReason) {
                case CONNECTION_UNREACHABLE:
                    obs.onError({reason: reason, details: details, code: code});
                    break;
                case CONNECTION_LOST:
                    if (!keepReconnecting.isDisposed)
                        return true;
                case CONNECTION_CLOSED:
                default:
                    obs.onCompleted();
                    break;
            }

            return false;
        };

        connection.open();

        return function () {
            connection && connection.close();
        };

    });
};
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

    var disposer = (__version == 2) ?
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
    var v2 = (__version == 2);
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
                    innerObservable = isPromise(subscription) ? observablePromise(subscription) : observableStatic.just(subscription);

                return observableCreate(function(innerObserver) {
                    return new CompositeDisposable(
                        new TopicDisposable(session, innerObservable),
                        innerObservable.subscribe(
                            innerObserver.onNext.bind(innerObserver),
                            innerObserver.onError.bind(innerObserver)));
                });
            });

        var onNext;
        if (openObserver) {
            (typeof openObserver === 'function') && (onNext = openObserver);
            (typeof openObserver === 'object') && (onNext = openObserver.onNext.bind(openObserver));
        }

        !onNext && (onNext = noop);

        //Cases - openObserver
        //1) undefined
        //2) function - pass it directly in
        //3) observer
        return subscriptionObservable.subscribe(
            onNext,
            obs.onError.bind(obs));

    }).publish().refCount();
};

observableWamp.publishAsObservable = observableStatic.publishAsObservable = function (session, topic, args, kwargs, options) {
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
    }).publish().refCount();
};

observableWamp.callAsObservable = observableStatic.callAsObservable = function (session, procedure, options) {

    return function () {
        var args = [procedure], len = arguments.length;
        for (var i = 0; i < len; ++i) args.push(arguments[i]);
        options && args.push(options);
        return observablePromise(session.call.apply(session, args));
    };
};
/**
 * Created by paulp_000 on 12/28/2014.
 */

var PubSubSubject = Rx.PubSubSubject = (function(__super__){
    Rx.internals.inherits(PubSubSubject, __super__);

    function PubSubSubject(session, topic, options, openObserver) {
        var self = this;
        this._errorObservable = new Rx.Subject();
        this._openObserver = new Rx.Subject();
        this.observable = observableStatic.subscribeAsObservable(session, topic, options, this._openObserver);
        this.observer = Rx.Observer.create(function(value){
            observableStatic.publishAsObservable(session, topic, value.args || value.event, value.kwargs, value.options)
                .subscribeOnError(self._errorObservable.onNext.bind(self._errorObservable));
        });

        Object.defineProperty(self, 'errors', {get : function() {
            return self._errorObservable.asObservable();
        }});

        Object.defineProperty(self, 'opened', {get : function() {
            return self._openObserver.asObservable();
        }});

        if (openObserver && (typeof openObserver === 'function' || typeof openObserver === 'object'))
            this.opened.subscribe(openObserver);

        __super__.call(this, this.observable.subscribe.bind(this.observable));
    }

    Rx.internals.addProperties(PubSubSubject.prototype, Rx.Observer, {
        onCompleted : function() {
            this.observer.onCompleted();
        },
        onError: function(exception) {
            this.observer.onError(exception);
        },
        onNext: function(value) {
            this.observer.onNext(value);
        }
    });

    return PubSubSubject;
})(Rx.Observable);

/**
 * Created by Paul on 4/7/2015.
 */


var Subscriber = (function(){

    function Subscriber(sessionOrObservable) {

        var observable = sessionOrObservable;
        if (sessionOrObservable.unsubscribe) {
            observable = observableStatic.just(sessionOrObservable);
        } else if (isPromise(sessionOrObservable)) {
            observable = observablePromise(sessionOrObservable);
        }

        this.observable = observable;
        this.disposable = new Rx.CompositeDisposable();
    }

    Subscriber.prototype.dispose = function(){
        this.disposable.dispose();
    };

    Subscriber.prototype.subscribeTo = function(topic, options, observerOrOnNext, onError, onCompleted) {
        var subscription = observableWamp
            .subscribeAsObservable(this.observable, topic, options)
            .subscribe(observerOrOnNext, onError, onCompleted);

        this.disposable.add(subscription);

        return this;
    };


    return Subscriber;
})();


observableWamp.subscriber = observableStatic.subscriber = function(sessionOrObservable) {
    return new Subscriber(sessionOrObservable);
};
    return Rx;
}));