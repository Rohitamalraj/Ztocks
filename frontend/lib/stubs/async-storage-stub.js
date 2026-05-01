// Browser-only stub for @react-native-async-storage/async-storage.
// MetaMask SDK references this module in some bundles even on web.

const AsyncStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
  clear: async () => undefined,
  getAllKeys: async () => [],
};

export default AsyncStorage;
export { AsyncStorage };
