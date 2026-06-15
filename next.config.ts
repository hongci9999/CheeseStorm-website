import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30, // 동적 페이지 클라이언트 라우터 캐시 30초 유지
    },
  },
};

export default nextConfig;
