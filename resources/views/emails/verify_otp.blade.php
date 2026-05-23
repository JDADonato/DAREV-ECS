<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Verification Code - Eloquente Catering System</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f9fafb;
            color: #374151;
            line-height: 1.6;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #f3f4f6;
        }
        .header {
            background-color: #720101;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 1px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .content h2 {
            color: #111827;
            font-size: 20px;
            margin-top: 0;
            margin-bottom: 20px;
        }
        .content p {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 25px;
        }
        .otp-box {
            background-color: #fef2f2;
            border: 2px dashed #720101;
            border-radius: 12px;
            padding: 30px 10px;
            margin: 35px auto;
            width: fit-content;
            min-width: 320px;
            text-align: center;
        }
        .otp-code {
            font-size: 56px;
            font-weight: 800;
            color: #720101;
            letter-spacing: 14px;
            margin: 0;
            margin-left: 14px; /* balances out the trailing letter-spacing */
            font-family: 'Courier New', Courier, monospace;
        }
        .footer {
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #f3f4f6;
        }
        .security-notice {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Eloquente Catering System</h1>
        </div>
        <div class="content">
            <h2>Email Verification Required</h2>
            <p>Welcome to Eloquente! To ensure the security of your account and complete your registration, please verify your email address using the code below.</p>
            
            <div class="otp-box">
                <p class="otp-code">{{ $otpCode }}</p>
            </div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            <p>If you did not request this verification, please safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} Eloquente Catering System. All rights reserved.</p>
            <p class="security-notice">Please do not reply to this email. For assistance, contact our support team.</p>
        </div>
    </div>
</body>
</html>
