/**
 * 전역 JWT 토큰 스토어.
 * 앱 시작 시 자동 로그인 후 발급된 accessToken을 저장하며,
 * 모든 API 함수가 이 스토어에서 토큰을 가져와 Authorization 헤더에 주입합니다.
 */

let _token: string | null = null;

export const authStore = {
  getToken: (): string | null => _token,

  setToken: (token: string): void => {
    _token = token;
  },

  clear: (): void => {
    _token = null;
  },

  /** Authorization 헤더 객체 반환. 토큰이 없으면 빈 객체. */
  authHeaders: (): Record<string, string> => {
    return _token ? { Authorization: `Bearer ${_token}` } : {};
  },
};
