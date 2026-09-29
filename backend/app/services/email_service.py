"""
HeatShield AI – Email Service
Sends SMTP emails for admin approval notifications.
Gracefully degrades: if SMTP is not configured, logs the content to console.
"""
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.utils.config import get_settings

logger = logging.getLogger("heatshield.email")
settings = get_settings()


def _send_smtp(to_email: str, subject: str, html_body: str) -> bool:
    """
    Send an email via SMTP with TLS.
    Returns True on success, False on failure.
    """
    if not settings.SMTP_ENABLED:
        logger.warning(
            "⚠️  SMTP not configured. Would have sent email to %s:\n  Subject: %s",
            to_email, subject
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

        logger.info("✉️  Email sent to %s: %s", to_email, subject)
        return True

    except Exception as exc:
        logger.error("❌  Failed to send email to %s: %s", to_email, exc)
        return False


# ── Email Templates ───────────────────────────────────────────────────────────

def send_admin_request_notification(
    applicant_name: str,
    applicant_email: str,
    request_id: int,
    approval_token: str,
    backend_url: str = "http://localhost:8000",
) -> bool:
    """
    Notify the super admin that a new admin account request is pending.
    Includes approve/reject links with secure single-use tokens.
    """
    subject = "HeatShield AI — New Admin Account Request"
    approve_url = f"{backend_url}/api/admin/requests/{request_id}/approve?token={approval_token}"
    reject_url = f"{backend_url}/api/admin/requests/{request_id}/reject?token={approval_token}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background:#0a0f1d; color:#e2e8f0; padding:32px;">
      <div style="max-width:520px;margin:auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
        <div style="background:linear-gradient(90deg,#f97316,#ef4444);height:6px;"></div>
        <div style="padding:32px;">
          <h2 style="color:#f97316;margin:0 0 8px;">🛡️ HeatShield AI</h2>
          <h3 style="color:#f1f5f9;margin:0 0 24px;">New Administrator Account Request</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:8px;color:#94a3b8;font-size:13px;font-weight:bold;">Applicant Name</td>
              <td style="padding:8px;color:#f1f5f9;font-size:13px;">{applicant_name}</td>
            </tr>
            <tr>
              <td style="padding:8px;color:#94a3b8;font-size:13px;font-weight:bold;">Applicant Email</td>
              <td style="padding:8px;color:#f1f5f9;font-size:13px;">{applicant_email}</td>
            </tr>
            <tr>
              <td style="padding:8px;color:#94a3b8;font-size:13px;font-weight:bold;">Request ID</td>
              <td style="padding:8px;color:#f1f5f9;font-size:13px;">#{request_id}</td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:13px;margin-bottom:24px;">
            This token is valid for 72 hours and can only be used once. You can also approve or reject
            this request from the Super Admin Dashboard.
          </p>
          <div style="display:flex;gap:12px;flex-direction:column;">
            <a href="{approve_url}"
               style="display:block;text-align:center;background:#16a34a;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
              ✅ APPROVE ADMIN ACCESS
            </a>
            <a href="{reject_url}"
               style="display:block;text-align:center;background:#dc2626;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;margin-top:10px;">
              ❌ REJECT REQUEST
            </a>
          </div>
          <p style="color:#475569;font-size:11px;margin-top:24px;text-align:center;">
            HeatShield AI — SIH26083 | Automated System Email
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    logger.info(
        "📨 Admin request notification | Request #%d | Applicant: %s <%s> | Token: %s...",
        request_id, applicant_name, applicant_email, approval_token[:12]
    )
    return _send_smtp(settings.ADMIN_APPROVAL_EMAIL, subject, html_body)


def send_admin_approved_email(admin_name: str, admin_email: str) -> bool:
    """Notify the applicant that their admin request was approved."""
    subject = "HeatShield AI — Your Admin Account Has Been Approved"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;background:#0a0f1d;color:#e2e8f0;padding:32px;">
      <div style="max-width:520px;margin:auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
        <div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:6px;"></div>
        <div style="padding:32px;">
          <h2 style="color:#22c55e;margin:0 0 8px;">✅ Access Granted</h2>
          <h3 style="color:#f1f5f9;margin:0 0 16px;">Your HeatShield AI Admin account is now active.</h3>
          <p style="color:#94a3b8;font-size:13px;">Hello {admin_name},</p>
          <p style="color:#94a3b8;font-size:13px;">
            Your administrator account for HeatShield AI has been approved by the primary administrator.
            You can now log in with your registered email and password.
          </p>
          <a href="http://localhost:5173"
             style="display:block;text-align:center;background:#f97316;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:bold;margin-top:24px;">
            Login to HeatShield AI
          </a>
        </div>
      </div>
    </body>
    </html>
    """
    return _send_smtp(admin_email, subject, html_body)


def send_admin_rejected_email(admin_name: str, admin_email: str) -> bool:
    """Notify the applicant that their admin request was rejected."""
    subject = "HeatShield AI — Admin Account Request Update"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;background:#0a0f1d;color:#e2e8f0;padding:32px;">
      <div style="max-width:520px;margin:auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #1e293b;">
        <div style="background:linear-gradient(90deg,#ef4444,#dc2626);height:6px;"></div>
        <div style="padding:32px;">
          <h2 style="color:#ef4444;margin:0 0 8px;">Request Not Approved</h2>
          <p style="color:#94a3b8;font-size:13px;">Hello {admin_name},</p>
          <p style="color:#94a3b8;font-size:13px;">
            Your administrator account request for HeatShield AI has not been approved at this time.
            If you believe this is an error, please contact the primary administrator.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    return _send_smtp(admin_email, subject, html_body)
