import nodemailer from 'nodemailer';
import { logger } from 'src/utils/log';

// 메일 전송을 담당할 '트랜스포터' 객체 생성
// Render 배포 환경에서의 ETIMEDOUT 방지를 위한 명시적인 타임아웃 설정
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, // 또는 465 (secure: true)
  secure: false, // 587번 포트를 사용할 경우 false, 465번 포트를 사용할 경우 true
  family: 4, // IPv6 연결 시도 시 발생하는 ENETUNREACH 에러 방지 (IPv4만 사용 강제)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 20000, // 20초 (서버 연결 대기 시간)
  greetingTimeout: 20000,   // 20초 (인사말 대기 시간)
  socketTimeout: 20000,     // 20초 (소켓 응답 대기 시간)
} as any);

export const sendVerificationEmail = async (to: string, code: string) => {
  const mailOptions = {
    from: `"Navi 서비스" <${process.env.EMAIL_USER}>`,
    to,
    subject: '[Navi] 회원가입 이메일 인증 번호입니다.',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>이메일 인증 번호</h2>
        <p>회원가입을 계속하려면 아래의 6자리 인증 번호를 입력해 주세요.</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">
          ${code}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 20px;">이 인증 번호는 3분 동안만 유효합니다.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.i(`인증 메일 전송 완료: ${to}`);
  } catch (error) {
    logger.e('인증 메일 전송 실패:', error);
    throw new Error('이메일 전송에 실패했습니다.');
  }
};