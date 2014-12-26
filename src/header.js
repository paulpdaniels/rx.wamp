var observableStatic = Rx.Observable,
    observableEmpty = observableStatic.empty,
    observablePromise = observableStatic.fromPromise,
    Disposable = Rx.Disposable,
    CompositeDisposable = Rx.CompositeDisposable,
    SerialDisposable = Rx.SerialDisposable,
    sessionProto = autobahn.Session.prototype;