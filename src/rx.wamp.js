

var autobahn = require('autobahn');
var Rx = require('rx');

var Observable = Rx.Observable;


autobahn.connectObservable = function(opts, reconnect) {

    var connection = new autobahn.Connection(opts);
    var shouldReconnect = new Rx.BehaviorSubject(true);

    (reconnect || Observable.empty()).subscribe(shouldReconnect);

    return Observable.create(function(observer){

        function onOpen(session){
            observer.onNext(session);
        }

        function onClose(reason, detail) {

            if (reason === 'closed') {
                observer.onCompleted();
            } else if (reason === 'unreachable') {
                observer.onError({reason : reason, detail : detail});
                observer.onCompleted();
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

        return function() {
            if (connection.isOpen) {
                connection.close();
            }
        };

    });
};

var sessionProto  = autobahn.Session.prototype;

sessionProto.subscribeObservable = function(topic, handler, options) {

    var self = this;

    return Observable.create(function(observer){

        function onNext(args, kwargs, details) {
            observer.onNext({args : args, kwargs : kwargs, details : details});
        }

        //Creates an observable from the promise
        var subscription = Observable.fromPromise(self.subscribe(topic, onNext, options));

        //We only care about errors propagating out of here
        subscription.subscribeOnError(observer);

        return function(){
            //Attempt to unsubscribe and forward the complete and error messages to the observer
            subscription.flatMap(function(sub){
                return Observable.fromPromise(self.unsubscribe(sub));
            })
                .never()
                .subscribe(observer);
        };


    });
};

sessionProto.registerObservable = function(procedure, endpoint, options){

    var self = this;

    return Observable.create(function(observer){

        var registration = Observable.fromPromise(self.register(procedure, endpoint, options));
        registration.subscribeOnError(observer);

        return function() {

            registration.flatMap(function(reg){
                return Observable.fromPromise(self.unregister(reg));
            })
                .never()
                .subscribe(observer);
        }
    });

};

sessionProto.callObservable = function(procedure, args, kwargs, options){
    return Observable.fromPromise(this.call(procedure, args, kwargs, options));
};

sessionProto.publishObservable = function(topic, args, kwargs, options) {

    var self = this;

    var publication = self.publish(topic, args, kwargs, options);

    return publication !== undefined ? Observable.fromPromise(publication) : Observable.empty();
};