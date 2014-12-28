
var _isV2Supported = function() {
    return typeof autobahn.version !== 'function' || autobahn.version() !== "?.?.?" && !!autobahn.Connection;
};