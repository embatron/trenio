async (page) => {
  const keys = Object.getOwnPropertyNames(globalThis).sort();
  return {
    keys,
    process: typeof process,
    require: typeof require,
    Buffer: typeof Buffer,
    fetch: typeof fetch,
  };
}
