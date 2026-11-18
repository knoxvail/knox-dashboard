// The census graph in the daily email is drawn on the server with next/og.
// That code reads its font and two .wasm files from beside itself at run
// time, so they are named here to be sure they are packed with the three
// routes that draw the graph.
const OG = "./node_modules/next/dist/compiled/@vercel/og/";
const graphFiles = ["index.node.js", "package.json", "resvg.wasm", "yoga.wasm", "noto-sans-v27-latin-regular.ttf"].map((f) => OG + f);

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/census/sync": graphFiles,
      "/api/census/job": graphFiles,
      "/api/census/chart": graphFiles,
    },
  },
  headers: async () => {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
