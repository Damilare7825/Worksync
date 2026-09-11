import { logger } from '../../../utils/logger.js';
import { BaseEmailProvider } from './base.provider.js';

export class MockEmailProvider extends BaseEmailProvider {
  async send({ to, subject, html, text }) {
    logger.info(`[email:mock] Would send email to ${to}`, {
      subject,
      hasHtml: Boolean(html),
      hasText: Boolean(text),
    });
    return { success: true, mode: 'mock' };
  }
}
