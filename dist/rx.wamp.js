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
    observableEmpty = observableStatic.empty,
    observablePromise = observableStatic.fromPromise,
    observerStatic = Rx.Observer,
    Subject = Rx.Subject,
    Disposable = Rx.Disposable,
    CompositeDisposable = Rx.CompositeDisposable,
    SerialDisposable = Rx.SerialDisposable,
    autobahn = autobahn || ab,
    sessionProto = autobahn.Session.prototype,
    isObservable = function(obs) { return obs && obs.subscribe;};

var _isV2Supported = function() {
    return typeof autobahn.version !== 'function' || autobahn.version() !== "?.?.?" && !!autobahn.Connection;
};
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

observableStatic.fromConnection = function (opts, keepReconnecting, factory) {

    var isV2Supported = _isV2Supported();

    var CONNECTION_CLOSED = autobahn.CONNECTION_CLOSED || "closed";
    var CONNECTION_UNREACHABLE = autobahn.CONNECTION_UNREACHABLE || "unreachable";
    var CONNECTION_LOST = autobahn.CONNECTION_LOST || "lost";

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
                    else
                        obs.onCompleted();
                    break;
                case CONNECTION_CLOSED:
                default:
                    obs.onCompleted();
                    break;

            }
        };

        connection.open();

        return function () {
            if (connection)
                connection.close();
        };

    });
};
/**
 * Created by Paul on 12/24/2014.
 */

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

                return Rx.Observable.create(function(innerObserver){
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

    return Rx;
}));