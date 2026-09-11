import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { renderTemplate } from '../../templates/email/index.js';
import { jobQueue } from '../../jobs/queue.js';
import { MockEmailProvider } from './providers/mock.provider.js';
import { SmtpEmailProvider } from './providers/smtp.provider.js';

function createProvider() {
  if (env.isProduction) {
    if (!env.smtpHost) {
      throw new Error('[email] Production mode requires a valid SMTP_HOST configuration');
    }
    if (!env.emailFrom) {
      throw new Error('[email] Production mode requires a valid EMAIL_FROM configuration');
    }
    return new SmtpEmailProvider({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      user: env.smtpUser,
      pass: env.smtpPass,
      from: env.emailFrom,
    });
  }
  return new MockEmailProvider();
}

export const emailService = {
  async send({ to, template, data }) {
    const rendered = renderTemplate(template, data);

    if (env.isProduction) {
      if (!env.smtpHost) {
        throw new Error('[email] Production email delivery failed: missing SMTP_HOST configuration');
      }
      if (!env.emailFrom) {
        throw new Error('[email] Production email delivery failed: missing EMAIL_FROM configuration');
      }
      const smtpProvider = createProvider();
      return smtpProvider.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    }

    logger.info(`[email:${env.nodeEnv}] Sent email to ${to}`, {
      template,
      subject: rendered.subject,
    });
    return { success: true, mode: 'mock' };
  },

  enqueueEmail({ to, template, data, idempotencyKey }) {
    return jobQueue.enqueue({
      type: 'EMAIL_DELIVERY',
      payload: { to, template, data },
      maxAttempts: 3,
      idempotencyKey,
    });
  },
};

export async function sendPasswordResetEmail(email, resetUrl) {
  return emailService.send({
    to: email,
    template: 'PASSWORD_RESET',
    data: { resetUrl },
  });
}

export async function sendWorkspaceInvitationEmail(email, workspaceName, inviteUrl, role) {
  return emailService.send({
    to: email,
    template: 'WORKSPACE_INVITATION',
    data: { workspaceName, inviteUrl, role },
  });
}

export async function sendWelcomeEmail(email, name, dashboardUrl) {
  return emailService.send({
    to: email,
    template: 'WELCOME',
    data: { name, dashboardUrl },
  });
}

export async function sendTaskAssignmentEmail(email, taskTitle, projectName, taskUrl) {
  return emailService.send({
    to: email,
    template: 'TASK_ASSIGNMENT',
    data: { taskTitle, projectName, taskUrl },
  });
}

export async function sendMentionNotificationEmail(email, authorName, taskTitle, commentText, taskUrl) {
  return emailService.send({
    to: email,
    template: 'MENTION',
    data: { authorName, taskTitle, commentText, taskUrl },
  });
}

export async function sendTaskReminderEmail(email, taskTitle, dueDate, taskUrl) {
  return emailService.send({
    to: email,
    template: 'TASK_REMINDER',
    data: { taskTitle, dueDate, taskUrl },
  });
}

jobQueue.registerProcessor('EMAIL_DELIVERY', async (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || typeof payload.to !== 'string' || !payload.to.trim()
    || typeof payload.template !== 'string' || !payload.template.trim()
    || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    const error = new TypeError('Malformed email delivery job payload');
    error.retryable = false;
    throw error;
  }
  const { to, template, data } = payload;
  await emailService.send({ to, template, data });
});
