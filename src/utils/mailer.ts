import { Resend, type PaginationOptions } from 'resend';
import { RESEND_KEY } from 'src/settings';
import { logger } from 'src/utils/log';

const resend = new Resend(RESEND_KEY);

export type VerificationType = 'registration' | 'password_reset';

export const sendVerificationEmail = async (to: string, code: string, type: VerificationType = 'registration') => {
  const isPasswordReset = type === 'password_reset';
  const subject = isPasswordReset 
    ? '[Navi] 비밀번호 재설정을 위한 인증 번호입니다.' 
    : '[Navi] 회원가입 이메일 인증 번호입니다.';
  
  const title = isPasswordReset ? '비밀번호 재설정 인증 번호' : '이메일 인증 번호';
  const description = isPasswordReset 
    ? '비밀번호를 재설정하려면 아래의 6자리 인증 번호를 입력해 주세요.' 
    : '회원가입을 계속하려면 아래의 6자리 인증 번호를 입력해 주세요.';

  try {
    const { data, error } = await resend.emails.send({
      from: 'Navi 서비스 <navi_noreply@navimailer.kro.kr>',
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>${title}</h2>
          <p>${description}</p>
          <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">
            ${code}
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">이 인증 번호는 5분 동안만 유효합니다.</p>
        </div>
      `,
    });

    if (error) {
      logger.e('인증 메일 전송 실패 (Resend):', error);
      throw new Error(`이메일 전송에 실패했습니다: ${error.message}`);
    }

    logger.i(`인증 메일 전송 완료: ${to} (ID: ${data?.id})`);
  } catch (error) {
    logger.e('인증 메일 전송 중 예기치 않은 오류 발생:', error);
    throw new Error('이메일 전송에 실패했습니다.');
  }
};

/**
 * 발송된 이메일 목록을 조회합니다. (Resend API)
 * 나중에 월별 사용량 로그 등에 활용될 예정입니다.
 */
export const listSentEmails = async (options: PaginationOptions = {}) => {
  try {
    const { data, error } = await resend.emails.list(options);

    if (error) {
      logger.e('이메일 목록 조회 실패 (Resend):', error);
      throw new Error(`이메일 목록 조회에 실패했습니다: ${error.message}`);
    }

    return data;
  } catch (error) {
    logger.e('이메일 목록 조회 중 예기치 않은 오류 발생:', error);
    throw new Error('이메일 목록 조회에 실패했습니다.');
  }
};