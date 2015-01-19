/**
 * Created by Paul on 12/24/2014.
 */

/**
 * Returns a subject that wraps publishing and subscribing to a WAMP topic
 * @param {Session} session - The session to wrap
 * @param {String} topic - The topic to publish and subscribe on
 * @param {Object} options - The options for subscription
 * @param {Observer} openObserver - An observer for opening the
 * @returns {PubSubSubject}
 */
observableStatic.fromPubSubPattern = function (session, topic, options, openObserver) {
    return new PubSubSubject(session, topic, options, openObserver);
};

/**
 * Subscribes on a topic
 * @param session
 * @param topic
 * @param options
 * @param openObserver
 */
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

/**
 * Publish on a topic
 * @param session
 * @param topic
 * @param args
 * @param kwargs
 * @param options
 * @returns {*}
 */
observableStatic.publishAsObservable = function (session, topic, args, kwargs, options) {
    //FIXME apparently we are not supposed to use the Array.prototype.slice work around to get values of the argument object
    var published = session.publish.apply(session, Array.prototype.slice.call(arguments, 1));
    return published ? observablePromise(published) : observableEmpty();
};

/**
 * Register a method using an observable
 *
 * @param session
 * @param procedure
 * @param endpoint
 * @param options
 */
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

/**
 * Call a method as an observable
 * @param session
 * @param procedure
 * @param options
 * @returns {Function}
 */
observableStatic.callAsObservable = function (session, procedure, options) {
    var args = [procedure];
    return function () {
        args = args.concat(Array.prototype.slice.call(arguments));
        if (options) args.push(options);
        return observablePromise(session.call.apply(session, args));
    };
};