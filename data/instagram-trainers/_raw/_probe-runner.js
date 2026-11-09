async (page) => {
  return {
    href: page.url(),
    hasProcess: typeof process,
    hasRequire: typeof require,
    keys: Object.keys(globalThis).slice(0, 30),
  };
}
