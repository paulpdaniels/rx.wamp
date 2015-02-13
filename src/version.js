
var _isV2Supported = function() {
    return typeof autobahn.version !== 'function' || autobahn.version() !== "?.?.?" && !!autobahn.Connection;
};

var CONNECTION_CLOSED = autobahn.CONNECTION_CLOSED || "closed",
    CONNECTION_UNREACHABLE = autobahn.CONNECTION_UNREACHABLE || "unreachable";
    CONNECTION_LOST = autobahn.CONNECTION_LOST || "lost";