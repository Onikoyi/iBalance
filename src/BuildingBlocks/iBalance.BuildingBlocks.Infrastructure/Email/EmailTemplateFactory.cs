namespace iBalance.BuildingBlocks.Infrastructure.Email;

public static class EmailTemplateFactory
{
    public static (string HtmlBody, string TextBody) CreatePasswordResetEmail(
        string recipientDisplayName,
        string organizationName,
        string resetLink,
        string supportEmail)
    {
        var safeName = string.IsNullOrWhiteSpace(recipientDisplayName) ? "User" : recipientDisplayName.Trim();
        var safeOrganization = string.IsNullOrWhiteSpace(organizationName) ? "iBalance" : organizationName.Trim();
        var safeSupportEmail = string.IsNullOrWhiteSpace(supportEmail) ? "support@ibalance.local" : supportEmail.Trim();

        var html = $"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#f7f5fb;font-family:Segoe UI,Arial,sans-serif;color:#1f1534;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(75,29,115,0.12);">
            <div style="margin-bottom:24px;">
                <div style="font-size:24px;font-weight:700;color:#4b1d73;">iBalance</div>
                <div style="font-size:14px;color:#6b6478;">Accounting Cloud</div>
            </div>

            <h1 style="margin:0 0 16px;font-size:24px;color:#1f1534;">Password Reset Request</h1>

            <p style="margin:0 0 16px;line-height:1.6;">
                Hello {safeName},
            </p>

            <p style="margin:0 0 16px;line-height:1.6;">
                We received a request to reset the password for your {safeOrganization} account.
            </p>

            <p style="margin:0 0 24px;line-height:1.6;">
                To continue, please use the button below:
            </p>

            <p style="margin:0 0 24px;">
                <a href="{resetLink}" style="display:inline-block;padding:14px 22px;background:#4b1d73;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
                    Reset Password
                </a>
            </p>

            <p style="margin:0 0 16px;line-height:1.6;">
                If you did not request this change, you can safely ignore this email.
            </p>

            <p style="margin:0 0 8px;line-height:1.6;">
                Need help? Contact <a href="mailto:{safeSupportEmail}" style="color:#4b1d73;">{safeSupportEmail}</a>.
            </p>
        </div>

        <div style="padding:16px 4px 0;color:#6b6478;font-size:12px;">
            © Nikosoft Technologies — iBalance Accounting Cloud
        </div>
    </div>
</body>
</html>
""";

        var text = $"""
iBalance Accounting Cloud

Password Reset Request

Hello {safeName},

We received a request to reset the password for your {safeOrganization} account.

Use the link below to continue:
{resetLink}

If you did not request this change, you can safely ignore this email.

Support: {safeSupportEmail}

© Nikosoft Technologies — iBalance Accounting Cloud
""";

        return (html, text);
    }

    public static (string HtmlBody, string TextBody) CreateSubscriptionApplicationReceivedEmail(
        string recipientDisplayName,
        string organizationName,
        string packageName,
        string paymentReference,
        string supportEmail)
    {
        var safeName = string.IsNullOrWhiteSpace(recipientDisplayName) ? "Customer" : recipientDisplayName.Trim();
        var safeOrganization = string.IsNullOrWhiteSpace(organizationName) ? "Your organization" : organizationName.Trim();
        var safePackageName = string.IsNullOrWhiteSpace(packageName) ? "Selected Plan" : packageName.Trim();
        var safePaymentReference = string.IsNullOrWhiteSpace(paymentReference) ? "Not available" : paymentReference.Trim();
        var safeSupportEmail = string.IsNullOrWhiteSpace(supportEmail) ? "support@ibalance.local" : supportEmail.Trim();

        var html = $"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Subscription Request Received</title>
</head>
<body style="margin:0;padding:0;background:#f7f5fb;font-family:Segoe UI,Arial,sans-serif;color:#1f1534;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(75,29,115,0.12);">
            <div style="margin-bottom:24px;">
                <div style="font-size:24px;font-weight:700;color:#4b1d73;">iBalance</div>
                <div style="font-size:14px;color:#6b6478;">Accounting Cloud</div>
            </div>

            <h1 style="margin:0 0 16px;font-size:24px;color:#1f1534;">Subscription Request Received</h1>

            <p style="margin:0 0 16px;line-height:1.6;">
                Hello {safeName},
            </p>

            <p style="margin:0 0 16px;line-height:1.6;">
                Your subscription request for <strong>{safeOrganization}</strong> has been received successfully.
            </p>

            <div style="background:#f7f5fb;border-radius:12px;padding:16px;margin:0 0 20px;">
                <div style="margin-bottom:8px;"><strong>Package:</strong> {safePackageName}</div>
                <div><strong>Payment Reference:</strong> {safePaymentReference}</div>
            </div>

            <p style="margin:0 0 16px;line-height:1.6;">
                Please keep your payment reference available for confirmation and support.
            </p>

            <p style="margin:0;line-height:1.6;">
                Need help? Contact <a href="mailto:{safeSupportEmail}" style="color:#4b1d73;">{safeSupportEmail}</a>.
            </p>
        </div>

        <div style="padding:16px 4px 0;color:#6b6478;font-size:12px;">
            © Nikosoft Technologies — iBalance Accounting Cloud
        </div>
    </div>
</body>
</html>
""";

        var text = $"""
iBalance Accounting Cloud

Subscription Request Received

Hello {safeName},

Your subscription request for {safeOrganization} has been received successfully.

Package: {safePackageName}
Payment Reference: {safePaymentReference}

Please keep your payment reference available for confirmation and support.

Support: {safeSupportEmail}

© Nikosoft Technologies — iBalance Accounting Cloud
""";

        return (html, text);
    }

    public static (string HtmlBody, string TextBody) CreateSubscriptionActivatedEmail(
        string recipientDisplayName,
        string organizationName,
        string packageName,
        string tenantKey,
        string signInUrl,
        string supportEmail)
    {
        var safeName = string.IsNullOrWhiteSpace(recipientDisplayName) ? "Customer" : recipientDisplayName.Trim();
        var safeOrganization = string.IsNullOrWhiteSpace(organizationName) ? "Your organization" : organizationName.Trim();
        var safePackageName = string.IsNullOrWhiteSpace(packageName) ? "Selected Plan" : packageName.Trim();
        var safeTenantKey = string.IsNullOrWhiteSpace(tenantKey) ? "Not available" : tenantKey.Trim();
        var safeSignInUrl = string.IsNullOrWhiteSpace(signInUrl) ? "#" : signInUrl.Trim();
        var safeSupportEmail = string.IsNullOrWhiteSpace(supportEmail) ? "support@ibalance.local" : supportEmail.Trim();

        var html = $"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Subscription Activated</title>
</head>
<body style="margin:0;padding:0;background:#f7f5fb;font-family:Segoe UI,Arial,sans-serif;color:#1f1534;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(75,29,115,0.12);">
            <div style="margin-bottom:24px;">
                <div style="font-size:24px;font-weight:700;color:#4b1d73;">iBalance</div>
                <div style="font-size:14px;color:#6b6478;">Accounting Cloud</div>
            </div>

            <h1 style="margin:0 0 16px;font-size:24px;color:#1f1534;">Subscription Activated</h1>

            <p style="margin:0 0 16px;line-height:1.6;">
                Hello {safeName},
            </p>

            <p style="margin:0 0 16px;line-height:1.6;">
                Your {safeOrganization} subscription is now active.
            </p>

            <div style="background:#f7f5fb;border-radius:12px;padding:16px;margin:0 0 20px;">
                <div style="margin-bottom:8px;"><strong>Package:</strong> {safePackageName}</div>
                <div><strong>Tenant Key:</strong> {safeTenantKey}</div>
            </div>

            <p style="margin:0 0 24px;">
                <a href="{safeSignInUrl}" style="display:inline-block;padding:14px 22px;background:#4b1d73;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
                    Sign In
                </a>
            </p>

            <p style="margin:0;line-height:1.6;">
                Need help? Contact <a href="mailto:{safeSupportEmail}" style="color:#4b1d73;">{safeSupportEmail}</a>.
            </p>
        </div>

        <div style="padding:16px 4px 0;color:#6b6478;font-size:12px;">
            © Nikosoft Technologies — iBalance Accounting Cloud
        </div>
    </div>
</body>
</html>
""";

        var text = $"""
iBalance Accounting Cloud

Subscription Activated

Hello {safeName},

Your {safeOrganization} subscription is now active.

Package: {safePackageName}
Tenant Key: {safeTenantKey}

Sign in: {safeSignInUrl}

Support: {safeSupportEmail}

© Nikosoft Technologies — iBalance Accounting Cloud
""";

        return (html, text);
    }
}