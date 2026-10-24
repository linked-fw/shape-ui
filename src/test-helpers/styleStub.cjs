// CSS modules under Jest: every class name maps to itself, so markup can be checked by class.
module.exports = new Proxy({}, {get: (_target, key) => (key === '__esModule' ? false : key)});
