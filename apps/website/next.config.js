/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@bankr-wallet/shared"],
  rewrites() {
    return {
      beforeFiles: [
        // coins.bankrwallet.app -> /coins
        {
          source: "/:path((?!_next|api|images|og|screenshots).*)",
          has: [
            {
              type: "host",
              value: "coins.bankrwallet.app",
            },
          ],
          destination: "/coins/:path*",
        },
        // stake.bankrwallet.app -> /stake
        {
          source: "/:path((?!_next|api|images|og|screenshots).*)",
          has: [
            {
              type: "host",
              value: "stake.bankrwallet.app",
            },
          ],
          destination: "/stake/:path*",
        },
      ],
    };
  },
};

module.exports = nextConfig;
