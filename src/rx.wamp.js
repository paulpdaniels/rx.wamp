'use strict';

var _autobahn = undefined;
var _rx = undefined;

try {
    _autobahn = require('autobahn');
    _rx = require('rx');
} catch (e) {
    //These are defined by the browser
    _autobahn = autobahn;
    _rx = Rx;
}

(function (Rx, autobahn) {

    var Observable = Rx.Observable;

    var _isV2 = autobahn.Connection != undefined;

    var _connectionExt_v1 = {

        connectObservable: function (uri, opts, reconnect) {
            return Observable.createWithDisposable(function (observer) {

                var shouldReconnect = new Rx.BehaviorSubject(true);
                (reconnect || Observable.empty()).subscribe(shouldReconnect);

                function onOpen(session) {
                    observer.onNext(session);
                }

                function onClose(code, reason, detail) {
                    switch (code) {
                        case autobahn.CONNECTION_CLOSED:
                            observer.onCompleted();
                            break;
                        case autobahn.CONNECTION_UNSUPPORTED:
                            observer.onError({code : code, reason : reason});
                            break;
                        case autobahn.CONNECTION_UNREACHABLE:
                            if (!shouldReconnect.value) {
                                observer.onCompleted();
                                return false;
                            } else {
                                return true;
                            }
                            break;
                    }
                }

                autobahn.connect(uri, onOpen, onClose, opts);

                return function () {
                    //FIXME switch to the lower level session API so we can discard the session.
                };

            });
        }
    };

    var _sessionExt_v1 = {

        publishObservable : function(topicUri, event, exclude, eligible){
            this.publish(topicUri, event, exclude, eligible);

            //Degenerate: the publish in v1 does not acknowledge, meaning we don't actually know what happens to this.
            //So just signal completion
            return Observable.empty();
        },

        subscribeObservable : function(topicUri){

            var self = this;

            return Observable.create(function(observer){

                function callback(topic, event) {
                    observer.onNext({topic : topic, event : event});
                }

                self.subscribe(topicUri, callback);

                return function(){
                    self.unsubscribe(topicUri, callback);
                };

            });



        },

        callObservable : function() {
            return Observable.fromPromise(this.call.apply(this, arguments));
        },

        caller : function(method) {
            var self = this;

            return function() {
                return self.callObservable.apply(self, arguments.splice(0, method));
            };
        }



    };

    var _connectionExt = {
        connectObservable: function (opts, reconnect) {

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
        }
    };

    var _sessionExt = {

        subscribeObservable: function (topic, options) {

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

                var disposable = Rx.Disposable.create(function () {
                    topicSubscription.dispose();
                    //Automatically unsubscribe
                    unsubscriber.
                        subscribe(function () {
                        },
                        observer.onError.bind(observer),
                        observer.onCompleted.bind(observer));
                });


                return new Rx.RefCountDisposable(disposable);
            });
        },
        registerObservable: function (procedure, endpoint, options) {

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

        },

        callObservable: function (procedure, args, kwargs, options) {
            return Observable.fromPromise(this.call(procedure, args, kwargs, options));
        },

        caller : function(method) {
            var self = this;

            return function(args, kwargs, options) {
                return self.callObservable.call(self, method, args, kwargs, options);
            };
        },

        publishObservable: function (topic, args, kwargs, options) {

            var self = this;

            var publication = self.publish(topic, args, kwargs, options);

            return publication !== undefined ? Observable.fromPromise(publication) : Observable.empty();
        }
    };




    for (var key in (_isV2 ? _connectionExt : _connectionExt_v1)) {
        autobahn[key] = _connectionExt[key];
    }

    var sessionProto = autobahn.Session.prototype;

    for (var key in (_isV2 ? _sessionExt : _sessionExt_v1)) {
        sessionProto[key] = _sessionExt[key];
    }

    return _isV2;

})(_rx, _autobahn);