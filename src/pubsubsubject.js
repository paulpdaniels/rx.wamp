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
