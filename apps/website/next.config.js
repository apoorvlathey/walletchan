/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@bankr-wallet/shared"],
  rewrites() {
    return {
      beforeFiles: [
        // coins.bankrwallet.app -> /coins
        {
          source: "/:path((?!_next|api).*)",
          has: [
            {
              type: "host",
              value: "coins.bankrwallet.app",
            },
          ],
          destination: "/coins/:path*",
        },
      ],
    };
  },
};

module.exports = nextConfig;
