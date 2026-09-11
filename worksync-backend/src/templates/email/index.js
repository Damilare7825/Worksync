export function renderTemplate(templateName, data = {}) {
  switch (templateName) {
    case 'WORKSPACE_INVITATION':
      return {
        subject: `You've been invited to join ${data.workspaceName} on WorkSync`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>Workspace Invitation</h2>
            <p>You have been invited to join <strong>${data.workspaceName}</strong> as a <strong>${data.role}</strong>.</p>
            <p><a href="${data.inviteUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
            <p style="color: #64748b; font-size: 12px;">If you did not expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
        text: `You've been invited to join ${data.workspaceName} on WorkSync. Accept here: ${data.inviteUrl}`,
      };

    case 'PASSWORD_RESET':
      return {
        subject: 'Reset your WorkSync password',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <p><a href="${data.resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
            <p style="color: #64748b; font-size: 12px;">This link will expire shortly. If you didn't request a password reset, no action is needed.</p>
          </div>
        `,
        text: `Reset your WorkSync password here: ${data.resetUrl}`,
      };

    case 'WELCOME':
      return {
        subject: 'Welcome to WorkSync!',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>Welcome to WorkSync, ${data.name}!</h2>
            <p>We are thrilled to have you onboard. WorkSync helps teams collaborate, track tasks, and launch projects seamlessly.</p>
            <p><a href="${data.dashboardUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
          </div>
        `,
        text: `Welcome to WorkSync, ${data.name}! Get started at ${data.dashboardUrl}`,
      };

    case 'TASK_ASSIGNMENT':
      return {
        subject: `Assigned to task: ${data.taskTitle}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>New Task Assigned</h2>
            <p>You have been assigned to task <strong>${data.taskTitle}</strong> in project <strong>${data.projectName}</strong>.</p>
            <p><a href="${data.taskUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">View Task</a></p>
          </div>
        `,
        text: `You were assigned to task "${data.taskTitle}" in project "${data.projectName}". View task: ${data.taskUrl}`,
      };

    case 'MENTION':
      return {
        subject: `You were mentioned in task: ${data.taskTitle}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>New Mention</h2>
            <p><strong>${data.authorName}</strong> mentioned you in a comment on task <strong>${data.taskTitle}</strong>.</p>
            <blockquote style="border-left: 3px solid #6366f1; padding-left: 10px; color: #475569;">"${data.commentText}"</blockquote>
            <p><a href="${data.taskUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">View Comment</a></p>
          </div>
        `,
        text: `${data.authorName} mentioned you in a comment on task "${data.taskTitle}": ${data.taskUrl}`,
      };

    case 'TASK_REMINDER':
      return {
        subject: `Reminder: ${data.taskTitle} is due soon`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>Task Due Reminder</h2>
            <p>The task <strong>${data.taskTitle}</strong> is due on <strong>${data.dueDate}</strong>.</p>
            <p><a href="${data.taskUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">View Task</a></p>
          </div>
        `,
        text: `Reminder: Task "${data.taskTitle}" is due on ${data.dueDate}. View task: ${data.taskUrl}`,
      };

    default:
      throw new Error(`Unknown email template: ${templateName}`);
  }
}
