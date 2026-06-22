// firebase SDK import 없는 순수 설정 플래그
// (SDK 모듈을 끌어오지 않아 클라이언트 번들에 firestore가 실리지 않음)
export const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
