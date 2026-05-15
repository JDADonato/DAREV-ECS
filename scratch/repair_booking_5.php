<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Booking;
use App\Models\Payment;
use App\Services\PaymentCalculationService;

$booking = Booking::find(5);
if ($booking && $booking->payments()->count() === 0) {
    echo "Repairing Booking #5...\n";
    $service = new PaymentCalculationService();
    $tranches = $service->calculateTranches($booking);
    
    foreach ($tranches as $tranche) {
        Payment::create([
            'booking_id'     => $booking->id,
            'amount'         => $tranche['amount'],
            'payment_method' => 'Pending',
            'status'         => 'Pending',
            'payment_type'   => $tranche['name'],
            'due_date'       => \Carbon\Carbon::parse($tranche['due_date'])->toDateString(),
        ]);
        echo "Created {$tranche['name']} - ₱{$tranche['amount']}\n";
    }
    echo "Repair complete!\n";
} else {
    echo "Booking #5 not found or already has payments.\n";
}
