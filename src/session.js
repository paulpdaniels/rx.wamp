/**
 * Created by Paul on 12/24/2014.
 */

sessionProto.subscribeAsObservable = function (topic, options) {
    var self = this;

    return observableStatic.create(function (obs) {

        var disposable = new SerialDisposable();

        function handler(args, kwargs, details) {
            obs.onNext({args: args, kwargs: kwargs, details: details});
        }

        function innerUnsubscribe(subscription) {
            self.unsubscribe(subscription);
        }

        var subscribed = observableStatic.fromPromise(self.subscribe(topic, handler, options));

        return new CompositeDisposable(
            disposable,
            subscribed
                .subscribe(
                function (subscription) {
                    disposable.setDisposable(innerUnsubscribe.bind(self, subscription));
                },
                obs.onError.bind(obs)));
    });
};

sessionProto.publishAsObservable = function (topic, args, kwargs, options) {
    var published = this.publish.apply(this, arguments);
    return published ? observableStatic.fromPromise(published) : observableStatic.empty();
};

sessionProto.registerAsObservable = function (procedure, endpoint, options) {

    var self = this;

    function innerUnregister(registration) {
        self.unregister(registration);
    }

    return observableStatic.create(function (obs) {

        var disposable = new SerialDisposable();

        var registered = observableStatic.fromPromise(self.register(procedure, endpoint, options));

        return new CompositeDisposable(
            disposable,
            registered.subscribe(function (registration) {
                disposable.setDisposable(innerUnregister.bind(registration));
            })
        );
    });
};

sessionProto.callAsObservable = function (procedure, options) {
    var self = this;
    var args = [procedure];
    return function() {
        args = args.concat(arguments);
        if (options) args.push(options);
        return observableStatic.fromPromise(self.call.apply(self, args));
    };
};