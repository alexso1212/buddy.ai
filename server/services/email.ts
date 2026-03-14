import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'BuddyAI <noreply@resend.dev>';

export async function sendEmail({ to, subject, text, html }: {
  to: string; subject: string; text: string; html?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured, email not sent');
    return { success: false, error: 'Email service not configured' };
  }

  const { data, error } = await resend.emails.send({
    from: FROM, to, subject, text, html: html ?? text,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  console.log(`[Email] Sent to ${to}, id=${data?.id}`);
  return data;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail({
    to: email,
    subject: 'BuddyAI - 重置密码',
    text: `你好，\n\n请点击以下链接重置密码（1 小时内有效）：\n\n${resetUrl}\n\n如果你没有请求重置密码，请忽略此邮件。\n\n— BuddyAI`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">BuddyAI</h2>
        <p style="color: #555; font-size: 15px;">你好，</p>
        <p style="color: #555; font-size: 15px;">请点击下方按钮重置密码（1 小时内有效）：</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background: #1a1a2e; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px;">重置密码</a>
        </div>
        <p style="color: #999; font-size: 13px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px;">如果你没有请求重置密码，请忽略此邮件。</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(email: string, verifyUrl: string) {
  return sendEmail({
    to: email,
    subject: 'BuddyAI - 验证邮箱',
    text: `你好，\n\n请点击以下链接验证你的邮箱（24 小时内有效）：\n\n${verifyUrl}\n\n— BuddyAI`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">BuddyAI</h2>
        <p style="color: #555; font-size: 15px;">你好，</p>
        <p style="color: #555; font-size: 15px;">请点击下方按钮验证你的邮箱地址（24 小时内有效）：</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="background: #1a1a2e; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px;">验证邮箱</a>
        </div>
        <p style="color: #999; font-size: 13px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px;">如果你没有请求验证邮箱，请忽略此邮件。</p>
      </div>
    `,
  });
}
