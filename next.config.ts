import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 기본은 ".next". 검증용 빌드가 개발 서버의 .next와 충돌하지 않도록 env로만 오버라이드 가능.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
