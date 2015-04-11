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

    Subscriber.prototype.to = function(topic, options, observerOrOnNext, onError, onCompleted) {
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