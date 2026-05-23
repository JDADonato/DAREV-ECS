<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Message - Eloquente Catering</title>
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
        }
        .content h2 {
            color: #111827;
            font-size: 20px;
            margin-top: 0;
            margin-bottom: 20px;
            text-align: center;
        }
        .content p {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 20px;
        }
        .message-box {
            background-color: #fef2f2;
            border-left: 4px solid #720101;
            padding: 20px;
            margin: 30px 0;
            font-style: italic;
            color: #111827;
        }
        .button-container {
            text-align: center;
            margin-top: 35px;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #720101;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16px;
        }
        .footer {
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #f3f4f6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Eloquente Catering System</h1>
        </div>
        <div class="content">
            <h2>You Have a New Message</h2>
            <p>Hello <strong>{{ $clientName }}</strong>,</p>
            <p><strong>{{ $staffName }}</strong> from our Marketing team has replied to your inquiry.</p>
            
            <div class="message-box">
                "{{ $preview }}"
            </div>
            
            <div class="button-container">
                <a href="{{ $appUrl }}" class="button">View Message & Reply</a>
            </div>
            
            <p style="text-align: center;">We look forward to making your event unforgettable!</p>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} Eloquente Catering. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
