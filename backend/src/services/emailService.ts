import net from 'net';
import tls from 'tls';
import { config } from '../config';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
}

class EmailService {
  private sentEmailsForTesting: SentEmailRecord[] = [];

  get isConfigured(): boolean {
    return Boolean(config.email.host && config.email.port);
  }

  getSentEmailsForTesting(): SentEmailRecord[] {
    return [...this.sentEmailsForTesting];
  }

  getLastSentEmailForTesting(): SentEmailRecord | undefined {
    return this.sentEmailsForTesting[this.sentEmailsForTesting.length - 1];
  }

  clearSentEmailsForTesting(): void {
    this.sentEmailsForTesting = [];
  }

  async sendMail(options: EmailOptions): Promise<boolean> {
    if (config.nodeEnv === 'test') {
      this.sentEmailsForTesting.push({
        ...options,
        sentAt: new Date().toISOString(),
      });
    }

    if (!this.isConfigured) {
      console.warn('========================================================================');
      console.warn('[TalentHub Email Service] SMTP Configuration Missing');
      console.warn('To enable production email delivery, configure the following variables:');
      console.warn('  SMTP_HOST=<smtp-server-hostname>');
      console.warn('  SMTP_PORT=587');
      console.warn('  SMTP_USER=<smtp-username>');
      console.warn('  SMTP_PASS=<smtp-password>');
      console.warn('  SMTP_FROM="TalentHub Security <no-reply@talenthub.com>"');
      console.warn('  SMTP_SECURE=false');
      // Never log recipient PII or reset tokens/URLs
      console.warn('========================================================================');
      return false;
    }

    try {
      await this.sendViaSmtp(options);
      return true;
    } catch (err: any) {
      console.error('[TalentHub Email Service] Failed to deliver email via SMTP:', err?.message || err);
      return false;
    }
  }

  private sendViaSmtp(options: EmailOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const { host, port, user, password, from, secure } = config.email;

      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const message = [
        `From: ${from}`,
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        options.text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        options.html,
        '',
        `--${boundary}--`,
        '.',
      ].join('\r\n');

      let socket: net.Socket;
      let buffer = '';

      const handleResponse = (line: string): void => {
        // SMTP state machine handler
      };

      const connectSocket = () => {
        if (secure) {
          return tls.connect({ host, port, rejectUnauthorized: false });
        }
        return net.connect({ host, port });
      };

      try {
        socket = connectSocket();
      } catch (e) {
        return reject(e);
      }

      socket.setTimeout(15000);

      socket.on('timeout', () => {
        socket.destroy(new Error('SMTP socket timeout'));
      });

      socket.on('error', (err) => {
        reject(err);
      });

      const write = (cmd: string) => {
        socket.write(cmd + '\r\n');
      };

      let state = 'INIT';

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const code = parseInt(line.substring(0, 3), 10);
          if (isNaN(code) || line.charAt(3) === '-') continue; // multiline response

          if (code >= 400) {
            socket.end();
            return reject(new Error(`SMTP Error ${code}: ${line}`));
          }

          switch (state) {
            case 'INIT':
              if (code === 220) {
                state = 'EHLO';
                write(`EHLO ${net.isIP(host) ? `[${host}]` : host || 'localhost'}`);
              }
              break;
            case 'EHLO':
              if (code === 250) {
                if (user && password) {
                  state = 'AUTH_LOGIN';
                  write('AUTH LOGIN');
                } else {
                  state = 'MAIL_FROM';
                  write(`MAIL FROM:<${from.replace(/.*<([^>]+)>.*/, '$1')}>`);
                }
              }
              break;
            case 'AUTH_LOGIN':
              if (code === 334) {
                state = 'AUTH_USER';
                write(Buffer.from(user).toString('base64'));
              }
              break;
            case 'AUTH_USER':
              if (code === 334) {
                state = 'AUTH_PASS';
                write(Buffer.from(password).toString('base64'));
              }
              break;
            case 'AUTH_PASS':
              if (code === 235) {
                state = 'MAIL_FROM';
                write(`MAIL FROM:<${from.replace(/.*<([^>]+)>.*/, '$1')}>`);
              }
              break;
            case 'MAIL_FROM':
              if (code === 250) {
                state = 'RCPT_TO';
                write(`RCPT TO:<${options.to}>`);
              }
              break;
            case 'RCPT_TO':
              if (code === 250) {
                state = 'DATA';
                write('DATA');
              }
              break;
            case 'DATA':
              if (code === 354) {
                state = 'DATA_SEND';
                write(message);
              }
              break;
            case 'DATA_SEND':
              if (code === 250) {
                state = 'QUIT';
                write('QUIT');
                socket.end();
                resolve();
              }
              break;
          }
        }
      });
    });
  }

  async sendPasswordResetEmail(email: string, name: string, resetUrl: string, expiresMinutes: number): Promise<boolean> {
    const subject = 'TalentHub - Reset Your Password';
    const text = [
      `Hello ${name},`,
      '',
      `We received a request to reset your password for your TalentHub account (${email}).`,
      '',
      `To choose a new password, open the following link:`,
      resetUrl,
      '',
      `This link is single-use and will expire in ${expiresMinutes} minutes.`,
      '',
      `If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.`,
      '',
      'Security tip: Never share this link with anyone. TalentHub staff will never ask for your password.',
      '',
      'The TalentHub Security Team',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your TalentHub Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 24px; margin: 0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 20px 32px; background: #0f172a; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Talent<span style="color: #60a5fa;">Hub</span></h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Enterprise Recruitment & ATS Platform</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Request</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
          Hello <strong>${escapeHtml(name)}</strong>,<br>
          We received a request to reset the password associated with your account (<strong>${escapeHtml(email)}</strong>).
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 16px 0;">
          This link is <strong>single-use</strong> and will automatically expire in <strong>${expiresMinutes} minutes</strong>.
        </p>
        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0 0 16px 0;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
          If you did not make this request, you can safely ignore this email. Your account remains secure and no changes were made.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
        &copy; ${new Date().getFullYear()} TalentHub Inc. • Automated security notification.
      </td>
    </tr>
  </table>
</body>
</html>
`;

    return this.sendMail({
      to: email,
      subject,
      text,
      html,
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const emailService = new EmailService();

