var autobahn = require('autobahn');
var Rx = require('rx');

var Observable = Rx.Observable;


autobahn.connectObservable = function (opts, reconnect) {

    return Observable.createWithDisposable(function (observer) {

        var connection = new autobahn.Connection(opts);
        var shouldReconnect = new Rx.BehaviorSubject(true);

        (reconnect || Observable.empty()).subscribe(shouldReconnect);

        function onOpen(session) {
            observer.onNext(session);
        }

        function onClose(reason, detail) {

            if (reason === 'closed') {
                observer.onCompleted();
            } else if (reason === 'unreachable') {
                observer.onError({reason: reason, detail: detail});
            } else if (reason === 'lost') {

                if (!shouldReconnect.value) {
                    observer.onCompleted();
                    return false;
                } else {
                    return true;
                }
            }
        }

        connection.onopen = onOpen;
        connection.onclose = onClose;

        connection.open();

        return function () {
            if (connection.isOpen) {
                connection.close();
            }
        };

    }).publish().refCount();
};

var sessionProto = autobahn.Session.prototype;

sessionProto.subscribeObservable = function (topic, options) {

    var self = this;

    return Observable.create(function (observer) {

        var subject = new Rx.Subject();

        function onNext(args, kwargs, details) {
            subject.onNext({args: args, kwargs: kwargs, details: details});
        }

        //Creates an observable from the promise
        var subscriber = Observable.fromPromise(self.subscribe(topic, onNext, options));

        var unsubscriber = subscriber.flatMap(function (token) {
            return Observable.fromPromise(self.unsubscribe(token));
        }).ignoreElements();

        //Forward the errors from connection on to the end user
        var topicSubscription = subscriber
            .map(function (_) {
                //Ignore the incoming event and just send the subject
                return subject.asObservable();
            })
            .subscribe(observer.onNext.bind(observer),
            observer.onError.bind(observer));


        return function () {
            topicSubscription.dispose();

            //Automatically unsubscribe
            unsubscriber.
                subscribe(function () {
                },
                observer.onError.bind(observer),
                observer.onCompleted.bind(observer));
        };
    });
};

sessionProto.registerObservable = function (procedure, endpoint, options) {

    var self = this;

    return Observable.create(function (observer) {

        var subscriber = Observable.fromPromise(self.register(procedure, endpoint, options));
        var unsubscriber = subscriber.flatMap(function (sub) {
            return Observable.fromPromise(self.unregister(sub));
        }).ignoreElements();

        subscriber.subscribe(observer.onNext.bind(observer), observer.onError.bind(observer));

        return function () {
            unsubscriber.subscribe(observer);
        }
    });

};

sessionProto.callObservable = function (procedure, args, kwargs, options) {
    return Observable.fromPromise(this.call(procedure, args, kwargs, options));
};

sessionProto.publishObservable = function (topic, args, kwargs, options) {

    var self = this;

    var publication = self.publish(topic, args, kwargs, options);

    return publication !== undefined ? Observable.fromPromise(publication) : Observable.empty();
};