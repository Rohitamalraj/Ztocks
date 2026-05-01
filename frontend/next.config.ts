import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
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
    };

    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // Stub out problematic modules that don't exist in the package
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /libsodium\.mjs$/,
        path.resolve(__dirname, 'lib/stubs/libsodium-stub.js')
      ),
      new webpack.NormalModuleReplacementPlugin(
        /tfhe_bg\.wasm$/,
        path.resolve(__dirname, 'lib/stubs/tfhe-stub.js')
      )
    );

    // Exclude fhevmjs from server-side rendering
    if (isServer) {
      config.externals = [...(config.externals || []), 'fhevmjs', 'libsodium-wrappers'];
    }

    return config;
  },
};

export default nextConfig;
