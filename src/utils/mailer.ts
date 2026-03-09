import nodemailer from 'nodemailer';
import { logger } from 'src/utils/log';

// 메일 전송을 담당할 '트랜스포터' 객체 생성
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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