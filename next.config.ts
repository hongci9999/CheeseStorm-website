import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300, // 동적 페이지 클라이언트 라우터 캐시 5분 유지
    },
  },
};

export default nextConfig;
