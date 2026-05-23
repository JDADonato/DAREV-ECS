@php
    $body = $announcement->email_body ?: $announcement->body ?: $announcement->summary;
@endphp

<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $announcement->email_subject ?: $announcement->title }}</title>
</head>
<body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#720101;color:#fff;border-radius:22px 22px 0 0;padding:26px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f0aa0b;">Eloquente Catering</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">{{ $announcement->title }}</h1>
        </div>
        <div style="background:#fff;border-radius:0 0 22px 22px;padding:26px;border:1px solid #eadfd7;border-top:0;">
            @if($announcement->summary)
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#4b5563;">{{ $announcement->summary }}</p>
            @endif
            <div style="font-size:15px;line-height:1.7;color:#374151;white-space:pre-line;">{{ $body }}</div>
            @if($announcement->cta_label && $announcement->cta_url)
                <p style="margin:26px 0 0;">
                    <a href="{{ $announcement->cta_url }}" style="display:inline-block;background:#f0aa0b;color:#1a1a1a;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 18px;">{{ $announcement->cta_label }}</a>
                </p>
            @endif
        </div>
    </div>
</body>
</html>
