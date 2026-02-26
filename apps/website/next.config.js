/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@bankr-wallet/shared"],
  async redirects() {
    return [
      // Redirect bankrwallet.app subdomains -> walletchan.com subdomains
      {
        source: "/:path*",
        has: [{ type: "host", value: "coins.bankrwallet.app" }],
        destination: "https://coins.walletchan.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "stake.bankrwallet.app" }],
        destination: "https://stake.walletchan.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "migrate.bankrwallet.app" }],
        destination: "https://migrate.walletchan.com/:path*",
        permanent: true,
      },
      // Redirect bankrwallet.app -> walletchan.com (main domain, must be last)
      {
        source: "/:path*",
        has: [{ type: "host", value: "bankrwallet.app" }],
        destination: "https://walletchan.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // coins.walletchan.com -> /coins
        {
          source: "/:path((?!_next|api|images|og|screenshots).*)",
          has: [
            {
              type: "host",
              value: "coins.walletchan.com",
            },
          ],
          destination: "/coins/:path*",
        },
        // stake.walletchan.com -> /stake
        {
          source: "/:path((?!_next|api|images|og|screenshots).*)",
          has: [
            {
              type: "host",
              value: "stake.walletchan.com",
            },
          ],
          destination: "/stake/:path*",
        },
        // migrate.walletchan.com -> /migrate
        {
          source: "/:path((?!_next|api|images|og|screenshots).*)",
          has: [
            {
              type: "host",
              value: "migrate.walletchan.com",
            },
          ],
          destination: "/migrate/:path*",
        },
      ],
    };
  },
};

module.exports = nextConfig;
