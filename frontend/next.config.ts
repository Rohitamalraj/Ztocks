import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Keep native-WASM Node packages out of webpack's server bundle.
  // node-tfhe / node-tkms load their sibling *_bg.wasm via `__dirname`,
  // which breaks once they're inlined into `.next/.../vendor-chunks/`.
  // Letting Next `require()` them from node_modules at runtime preserves
  // the sibling-file layout the relayer SDK expects.
  serverExternalPackages: [
    "@zama-fhe/relayer-sdk",
    "node-tfhe",
    "node-tkms",
    "tfhe",
    "tkms",
  ],
  webpack: (config, { isServer, webpack }) => {
    // Fix for fhevmjs and libsodium-wrappers
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // MetaMask SDK web bundle can reference this React Native module.
    // Stub it for the browser build so webpack can compile.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "lib/stubs/async-storage-stub.js"
      ),
      // ffjavascript imports `web-worker` to create workers.
      // In webpack/Next server builds, resolution can pick the Node entry (`cjs/node.js`),
      // which triggers a "Critical dependency" warning and slows compilation.
      // Force the browser implementation for all builds.
      "web-worker": path.resolve(__dirname, "node_modules/web-worker/cjs/browser.js"),
      "web-worker/cjs/node": path.resolve(__dirname, "node_modules/web-worker/cjs/browser.js"),
      "web-worker/cjs/node.js": path.resolve(__dirname, "node_modules/web-worker/cjs/browser.js"),
      // libsodium-wrappers ESM entry imports ./libsodium.mjs which webpack often fails to resolve
      "libsodium-wrappers": path.resolve(
        __dirname,
        "node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
      ),
    };

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Note: libsodium and tfhe WASM must load at runtime for fhevmjs to work.
    // Do NOT stub these out — fhevmjs needs the real WASM files.

    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        "fhevmjs",
        "libsodium-wrappers",
        "@zama-fhe/relayer-sdk",
        "@zama-fhe/relayer-sdk/node",
        "node-tfhe",
        "node-tkms",
      ];
    }

    return config;
  },
};

export default nextConfig;
