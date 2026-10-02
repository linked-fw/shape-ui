// CSS modules under jest: `style.foo` is the string 'foo'. Anything that is not a plain class
// lookup (symbols, Object.prototype members, the ESM interop probes) behaves like a normal object.
const passthrough = new Set(['__esModule', 'then', 'toJSON', 'constructor']);
const proxy = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== 'string' || passthrough.has(key) || key in Object.prototype) {
        return Reflect.get(target, key);
      }
      if (key === 'default') return proxy;
      return key;
    },
  },
);
module.exports = proxy;
