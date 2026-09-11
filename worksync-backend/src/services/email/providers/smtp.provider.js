import nodemailer from 'nodemailer';
import { logger } from '../../../utils/logger.js';
import { BaseEmailProvider } from './base.provider.js';

export class SmtpEmailProvider extends BaseEmailProvider {
  constructor(config) {
    super();
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10 * 1000,
      greetingTimeout: 10 * 1000,
      socketTimeout: 30 * 1000,
    });
  }

  async send({ to, subject, html, text }) {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        html,
        text,
      });
      logger.info(`[email:smtp] Dispatched email to ${to}`, {
        messageId: info.messageId,
        subject,
      });
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      logger.error(`[email:smtp] Failed to send email to ${to}`, {
        error: err.message,
        subject,
      });
      throw err;
    }
  }
}
