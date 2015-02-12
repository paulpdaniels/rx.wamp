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

observableStatic.fromConnection = function (opts, keepReconnecting, factory) {

    var isV2Supported = _isV2Supported();

    var CONNECTION_CLOSED = autobahn.CONNECTION_CLOSED || "closed";
    var CONNECTION_UNREACHABLE = autobahn.CONNECTION_UNREACHABLE || "unreachable";
    var CONNECTION_LOST = autobahn.CONNECTION_LOST || "lost";

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
                    else
                        obs.onCompleted();
                    break;
                case CONNECTION_CLOSED:
                default:
                    obs.onCompleted();
                    break;

            }
        };

        connection.open();

        return function () {
            if (connection)
                connection.close();
        };

    });
};