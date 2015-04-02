/**
 * Created by Paul on 12/24/2014.
 */


autobahn._connection_cls = autobahn.Connection || function (opts) {

    var url;
    if (typeof opts === 'string') {
        url = opts;
        opts = {};
    } else if (typeof opts === 'object') {
        url = opts.uri || opts.url;
    } else {
        throw new Error('Wamp options must not be undefined or null!');
    }

    var disposable = new SerialDisposable();

    this._onopen = function (session) {

        disposable.setDisposable(Disposable.create(function () {
            session.close();
        }));

        if (!disposable.isDisposed && this.onopen)
            this.onopen(session);
    };

    this.open = function () {
        autobahn.connect(url, this._onopen.bind(this), this.onclose, opts);
    };

    this.close = function () {
        disposable.dispose();
    };

    this.onopen = null;
    this.onclose = null;

};

function _connection_factory(opts) {
    return new autobahn._connection_cls(opts);
}

observableWamp.fromConnection = observableStatic.fromConnection = function (opts, keepReconnecting, factory) {

    var isV2Supported = _detectVersion();



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
                    if (!keepReconnecting.isDisposed)
                        return true;
                case CONNECTION_CLOSED:
                default:
                    obs.onCompleted();
                    break;
            }

            return false;
        };

        connection.open();

        return function () {
            connection && connection.close();
        };

    });
};