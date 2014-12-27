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
            root.Rx = factory(root, exports, Rx);
            return root.Rx;
        });
    } else if (typeof module === 'object' && module && module.exports === freeExports) {
        module.exports = factory(root, module.exports, require('rx'), require('autobahn'));
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
    sessionProto = autobahn.Session.prototype;

var _isV2Supported = function() {
    return autobahn.version !== "?.?.?" && !!autobahn.Connection;
};
/**
 * Created by Paul on 12/24/2014.
 */

function _connection_factory(opts) {

    return new (autobahn.Connection || function (opts) {

        this.uri = opts.uri;

        var disposable = new SerialDisposable();


        this._onopen = function (session) {

            disposable.setDisposable(function () {
                session.close();
            });

            if (!disposable.isDisposed && this.onopen)
                this.onopen(session);
        };

        this.open = function () {
            autobahn.connect(this.uri, this._onopen, this.onclose, opts);
        };

        this.close = function () {
            disposable.dispose();
        };

        this.onopen = null;
        this.onclose = null;

    })(opts);
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
                    if(!keepReconnecting.isDisposed)
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

    var observable = observableStatic.subscribeAsObservable(session, topic, options, openObserver);
    var observer = Rx.Observer.create(function (value) {
        observableStatic.publishAsObservable(session, topic, value.args || value.event, value.kwargs, value.options);
    });

    return Subject.create(observer, observable);

};


observableStatic.subscribeAsObservable = function (session, topic, options, openObserver) {
    return observableStatic.create(function (obs) {

        var compositeDisposable = new CompositeDisposable();

        var disposable = new SerialDisposable();

        var handler = !_isV2Supported() ?
            function (topic, event) {
                obs.onNext({topic: topic, event: event});
            } :
            function (args, kwargs, details) {

                var next = {};
                if (args) next.args = args;
                if (kwargs) next.kwargs = kwargs;
                if (details) next.details = details;

                obs.onNext(next);
            };

        var subscription = session.subscribe(topic, handler, options);

        var innerUnsubscribe = subscription ?
            function (sub) {
                session.unsubscribe(sub);
            } :
            function (sub) {
                session.unsubscribe(sub.topic, sub.handler);
            };


        var subscribed = subscription ? observablePromise(subscription) :
            observableStatic.just({
                topic: topic,
                handler: handler
            });

        if (openObserver)
            compositeDisposable.add(subscribed.subscribe(openObserver));


        compositeDisposable.add(disposable);
        compositeDisposable.add(subscribed.subscribe(
            function (subscription) {
                disposable.setDisposable(Disposable.create(innerUnsubscribe.bind(session, subscription)));
            },
            obs.onError.bind(obs))
        );



        return compositeDisposable;
    });
};

observableStatic.publishAsObservable = function (session, topic, args, kwargs, options) {
    //FIXME apparently we are not supposed to use the Array.prototype.slice work around to get values of the argument object
    var published = session.publish.apply(session, Array.prototype.slice.call(arguments, 1));
    return published ? observablePromise(published) : observableEmpty();
};

observableStatic.registerAsObservable = function (session, procedure, endpoint, options) {

    function innerUnregister(registration) {
        session.unregister(registration);
    }

    return observableStatic.create(function (obs) {

        var disposable = new SerialDisposable();

        var registered = observablePromise(session.register(procedure, endpoint, options));

        return new CompositeDisposable(
            disposable,
            registered
                .do(function (registration) {
                    disposable.setDisposable(Disposable.create(innerUnregister.bind(null, registration)));
                })
                .subscribe(obs)
        );
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
    return Rx;
}));