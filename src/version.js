
var _isV2Supported = function() {
    return autobahn.version !== "?.?.?" && !!autobahn.Connection;
};