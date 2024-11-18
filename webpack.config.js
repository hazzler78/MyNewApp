const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons']
    }
  }, argv);

  // Add this for WebSocket support
  config.devServer = {
    ...config.devServer,
    hot: true,
    client: {
      overlay: false,
      webSocketURL: 'auto://0.0.0.0:0/ws'
    }
  };

  return config;
};