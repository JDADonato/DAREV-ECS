<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Your Verification Code</title>
</head>
<body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #ead8cc;border-radius:16px;padding:28px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9f6500;">Eloquente Catering</p>
            <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#111827;">Your verification code</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">Use this code to continue your {{ $purpose }}. It expires in {{ $expiresInMinutes }} minutes.</p>
            <div style="display:inline-block;border-radius:12px;background:#720101;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:8px;padding:14px 18px;">
                {{ $otpCode }}
            </div>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If you did not request it, you can ignore this email.</p>
        </div>
    </div>
</body>
</html>
