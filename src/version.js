
var _detectVersion = function() {
    return (typeof autobahn.version !== 'function' || autobahn.version() !== "?.?.?" && !!autobahn.Connection) ? 2 : 1;
};

var __version = _detectVersion();

var CONNECTION_CLOSED = autobahn.CONNECTION_CLOSED || "closed",
    CONNECTION_UNREACHABLE = autobahn.CONNECTION_UNREACHABLE || "unreachable",
    CONNECTION_LOST = autobahn.CONNECTION_LOST || "lost";