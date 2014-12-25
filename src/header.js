var observableStatic = Rx.Observable,
    Disposable = Rx.Disposable,
    CompositeDisposable = Rx.CompositeDisposable,
    SerialDisposable = Rx.SerialDisposable,
    sessionProto = autobahn.Session.prototype;