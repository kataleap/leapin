// Phase 4 doc §5.1/§9: no sensitive data (passport/ID numbers, financial
// details) in the email body — just a direct link back to the platform,
// which requires login to see any detail. Kept deliberately simple: one
// table-based layout, inline styles, RTL Arabic.

export function buildNotificationEmail(params: {
  title: string;
  message: string;
  link: string;
}): { subject: string; html: string } {
  const { title, message, link } = params;

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Tahoma,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;padding:32px;text-align:right;">
            <tr>
              <td style="font-size:18px;font-weight:bold;color:#111111;padding-bottom:12px;">
                ${escapeHtml(title)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#333333;line-height:1.8;padding-bottom:24px;">
                ${escapeHtml(message)}
              </td>
            </tr>
            <tr>
              <td>
                <a href="${escapeAttribute(link)}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">
                  عرض التفاصيل في منصة Leapin
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: title, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
