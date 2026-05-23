@php
    $name = $draft['client_full_name'] ?? $user->username ?? 'there';
    $eventDate = !empty($draft['event_date']) ? \Carbon\Carbon::parse($draft['event_date'])->format('F j, Y') : null;
    $eventType = $draft['event_type'] ?? null;
    $pax = $draft['pax'] ?? null;
    $total = isset($draft['total_cost']) ? number_format((float) $draft['total_cost'], 2) : null;
@endphp

<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
    <h2 style="color: #720101; margin-bottom: 12px;">Your Eloquente booking is almost there</h2>
    <p>Hello {{ $name }},</p>
    <p>
        We saved your event planning progress, so you can continue right where you left off.
        A few more details will help us check availability, pricing, and service readiness for your event.
    </p>

    <div style="margin: 20px 0; padding: 16px; border: 1px solid #f1e2c5; border-radius: 12px; background: #fffaf3;">
        <p style="margin: 0 0 8px; font-weight: 700; color: #720101;">Draft summary</p>
        @if($eventType)<p style="margin: 4px 0;">Event: {{ $eventType }}</p>@endif
        @if($eventDate)<p style="margin: 4px 0;">Date: {{ $eventDate }}</p>@endif
        @if($pax)<p style="margin: 4px 0;">Guests: {{ $pax }}</p>@endif
        @if($total)<p style="margin: 4px 0;">Current estimate: PHP {{ $total }}</p>@endif
        <p style="margin: 4px 0;">Saved step: {{ $draft['step'] ?? 'In progress' }}</p>
    </div>

    <p>
        Continue your booking when you are ready:
        <a href="{{ url('/book') }}" style="color: #720101; font-weight: 700;">open your booking draft</a>.
    </p>

    <p style="color: #6b7280; font-size: 13px;">
        If your plans changed, you can also start fresh from the booking page.
    </p>
</div>
