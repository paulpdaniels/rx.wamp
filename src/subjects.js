/**
 * Created by Paul on 10/9/2014.
 */


var WampSubject = Rx.WampSubject = (function(_super) {

    function subscribe(observer) {
        checkDisposed.call(this);

        if (!this.isStopped) {
            this.observers.push(observer);

            return new InnerSubscription(this, observer);
        }


        var ex = this.exception;
        if (ex) {
            observer.onError(ex);
        }

        else {
            observer.onCompleted();
        }

        return disposableEmpty;
    }

    inherits(WampSubject, _super);

    function WampSubject(client, topic) {
        _super.call(this, subscribe);
        this._client = client;
        this._topic = topic;

        this.observers = [];
        this.isDisposed  = false;
        this.isStopped = false;
        this.exception = null;

        var self = this;

        client.subscribe(topic, function(value){
            checkDisposed.call(self);
            if (!self.isStopped) {
                var os = self.observers.slice(0);
                for (var i = 0, len = os.length; i < len; i++) {
                    os[i].onNext(value);
                }
            }
        });
    }

    addProperties(WampSubject.prototype, Observer, {

        hasObservers: function() {
            return this.observers.length > 0;
        },

        onCompleted : function() {
            checkDisposed.call(this);

            if (!this.isStopped) {
                var os = this.observers.slice(0);
                this.isStopped = true;
                for (var i = 0, len = os.length; i < len; i++) {
                    os[i].onCompleted();
                }

                this.observers = [];
            }
        },
        onError: function (exception) {
            checkDisposed.call(this);
            if (!this.isStopped) {
                var os = this.observers.slice(0);
                this.isStopped = true;
                this.exception = exception;
                for (var i = 0, len = os.length; i < len; i++) {
                    os[i].onError(exception);
                }

                this.observers = [];
            }
        },
        onNext: function (value) {
            checkDisposed.call(this);
            if (!this.isStopped) {
                this._client.publish(this._topic, value);
            }
        },
        dispose: function () {
            this.isDisposed = true;
            this.observers = null;
        }
    });

    WampSubject.create = function(client, topic) {
        return new WampSubject(client, topic);
    }



})(Rx.Observable);