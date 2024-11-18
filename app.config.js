module.exports = {
    expo: {
      name: "FlySwatter",
      slug: "fly-swatter",
      version: "1.0.0",
      orientation: "portrait",
      userInterfaceStyle: "light",
      assetBundlePatterns: [
        "**/*"
      ],
      ios: {
        supportsTablet: true
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#ffffff"
        }
      },
      web: {
        bundler: "metro",
        build: {
          babel: {
            include: ["@expo/vector-icons"]
          }
        }
      }
    }
  };