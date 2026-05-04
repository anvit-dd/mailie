import type { NextConfig } from "next";
import { fileURLToPath } from "url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ['mailie.anvit.cloud'],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
