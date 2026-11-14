const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter = null;

function getTransporter() {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

const layout = (heading, body, cta) => `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px;color:#4338ca">CampusConnect</h2>
    <h3 style="margin:16px 0 8px">${heading}</h3>
    <p style="line-height:1.6;color:#334155">${body}</p>
    ${cta ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>
    <p style="font-size:12px;color:#64748b">Or paste this link into your browser:<br>${cta.url}</p>` : ''}
  </div>`;

/**
 * Sends an email through SMTP. When SMTP is not configured (local development)
 * the message is printed to the console instead, so the flow stays testable.
 * Returns { delivered } so callers can expose a dev link when nothing was sent.
 */
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    if (!config.isTest) {
      console.log(`\n[email:dev] SMTP not configured — email not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text}\n`);
    }
    return { delivered: false };
  }
  await t.sendMail({ from: config.smtp.from, to, subject, html, text });
  return { delivered: true };
}

const sendVerificationEmail = (user, url) =>
  sendEmail({
    to: user.email,
    subject: 'Verify your CampusConnect account',
    text: `Hi ${user.name}, verify your university email: ${url} (valid for 24 hours)`,
    html: layout(
      `Welcome, ${user.name}!`,
      'Please confirm your university email address to activate your CampusConnect account. The link is valid for 24 hours.',
      { url, label: 'Verify email' }
    ),
  });

const sendPasswordResetEmail = (user, url) =>
  sendEmail({
    to: user.email,
    subject: 'Reset your CampusConnect password',
    text: `Hi ${user.name}, reset your password here: ${url} (valid for 30 minutes). Ignore this email if you did not request it.`,
    html: layout(
      'Password reset requested',
      'Click the button below to choose a new password. The link expires in 30 minutes. If you did not request this, you can safely ignore this email.',
      { url, label: 'Reset password' }
    ),
  });

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
