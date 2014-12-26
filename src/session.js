/**
 * Created by Paul on 12/24/2014.
 */

sessionProto.subscribeAsObservable = function (topic, options) {
    var self = this;

    return observableStatic.create(function (obs) {

        var disposable = new SerialDisposable();

        var handler = isV2Supported ?
            function(topic, event) {obs.onNext({topic : topic, event : event});} :
            function(args, kwargs, details) {
                obs.onNext({args: args, kwargs: kwargs, details: details});
            };

        var subscription = self.subscribe(topic, handler, options);

        var innerUnsubscribe = subscription ?
            function (sub) { self.unsubscribe(sub);} :
            function (sub) { self.unsubscribe(sub.topic, sub.handler);};


        var subscribed = subscription ? observablePromise(subscription) :
            observableStatic.just({
                topic : topic,
                handler : handler
            });

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
    return published ? observablePromise(published) : observableEmpty();
};

sessionProto.registerAsObservable = function (procedure, endpoint, options) {

    var self = this;

    function innerUnregister(registration) {
        self.unregister(registration);
    }

    return observableStatic.create(function (obs) {

        var disposable = new SerialDisposable();

        var registered = observablePromise(self.register(procedure, endpoint, options));

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
        return observablePromise(self.call.apply(self, args));
    };
};