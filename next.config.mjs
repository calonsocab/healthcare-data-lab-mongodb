import path from 'node:path';

const localSherpaEnabled = process.env.ENABLE_LOCAL_SHERPA === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: [
      '@leafygreen-ui/combobox',
      '@leafygreen-ui/text-input',
      '@leafygreen-ui/button',
      '@leafygreen-ui/theme',
      ...(localSherpaEnabled ? ['demo-sherpa'] : []),
    ],

    // Improve dev server stability during hot reload
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in buffer
      maxInactiveAge: 60 * 1000,
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 5,
    },

    // Redirect favicon.ico to icon.svg
    async rewrites() {
      return [
        {
          source: '/favicon.ico',
          destination: '/icon.svg',
        },
      ];
    },

    // Webpack configuration for more stable caching
    webpack: (config, { dev }) => {
      if (!localSherpaEnabled) {
        config.resolve = config.resolve || {};
        config.resolve.alias = {
          ...(config.resolve.alias || {}),
          'demo-sherpa$': path.resolve(process.cwd(), 'src/components/integrations/demoSherpa/demoSherpaStub.js'),
        };
      }

      if (dev) {
        // Use memory cache in development to avoid filesystem corruption issues
        config.cache = {
          type: 'memory'
        };
      }
      return config;
    }
  }

export default nextConfig;
