import { authStore } from './authStore';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
}

const MASTER_EMAIL = import.meta.env.VITE_MASTER_EMAIL as string | undefined;
const MASTER_PASSWORD = import.meta.env.VITE_MASTER_PASSWORD as string | undefined;

/**
 * VITE_MASTER_EMAIL / VITE_MASTER_PASSWORD 환경변수로 설정된
 * 마스터(슈퍼) 계정으로 자동 로그인합니다.
 * 성공 시 발급된 JWT를 authStore에 저장합니다.
 */
export const autoLoginWithMaster = async (): Promise<void> => {
  if (!MASTER_EMAIL || !MASTER_PASSWORD) {
    console.warn(
      '[test-ui] VITE_MASTER_EMAIL / VITE_MASTER_PASSWORD 환경변수가 없습니다.\n' +
      'tools/test-ui/.env.local 파일을 생성하고 해당 변수를 주입하세요.'
    );
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MASTER_EMAIL, password: MASTER_PASSWORD }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[test-ui] 자동 로그인 실패 (${response.status}):`, text);
      return;
    }

    const data: LoginResponse = await response.json();
    authStore.setToken(data.accessToken);
    console.info(`[test-ui] 마스터 계정으로 자동 로그인 성공 (${data.user.email})`);
  } catch (err) {
    console.error('[test-ui] 자동 로그인 중 오류 발생:', err);
  }
};
