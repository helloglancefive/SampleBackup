import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import get_settings

logger = logging.getLogger("email")


def send_password_reset_email(to_email: str, raw_token: str) -> bool:
    """Send a password reset email. Returns True if sent, False if SMTP is not configured."""
    settings = get_settings()

    if not settings.smtp_host or not settings.smtp_user:
        logger.warning(
            "SMTP not configured — password reset email not sent. "
            "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env to enable email delivery."
        )
        return False

    reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"

    text_body = (
        "Reset your GlanceFive password\n\n"
        "Click the link below to set a new password. The link expires in 1 hour.\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email."
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#06101c;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#06101c;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#0c1a2e;border:1px solid rgba(100,160,240,0.1);border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#08152a,#0c1a2e);padding:28px 40px;
                     border-bottom:1px solid rgba(100,160,240,0.07);">
            <span style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;
                         text-transform:uppercase;color:#f0b429;">GlanceFive</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#d8eaf8;">
              Reset your password
            </h1>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#6e8faa;">
              We received a request to reset the password for your GlanceFive account.
              Click the button below to choose a new password. This link expires in
              <strong style="color:#d8eaf8;">1 hour</strong>.
            </p>
            <a href="{reset_url}"
               style="display:inline-block;padding:13px 28px;background:#f0b429;color:#06101c;
                      text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;
                      letter-spacing:0.02em;">
              Reset password
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#3d5570;line-height:1.6;">
              If you did not request a password reset, you can safely ignore this email —
              your password will not change.<br><br>
              Or copy this link:
              <span style="color:#64a0f0;word-break:break-all;">{reset_url}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(100,160,240,0.07);">
            <p style="margin:0;font-size:11px;color:#3d5570;">
              &copy; 2026 GlanceFive &middot; Amazon Ads Intelligence
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your GlanceFive password"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, to_email, msg.as_string())
        server.quit()
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False
