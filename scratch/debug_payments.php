<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Booking;
use App\Models\Payment;

$bookings = Booking::all();
echo "BOOKINGS:\n";
foreach($bookings as $b) {
    echo "ID: {$b->id}, Name: {$b->client_full_name}, Total: {$b->total_cost}, Status: {$b->status}\n";
    $payments = Payment::where('booking_id', $b->id)->get();
    echo "  PAYMENTS:\n";
    foreach($payments as $p) {
        echo "    ID: {$p->id}, Type: {$p->payment_type}, Amount: {$p->amount}, Status: {$p->status}\n";
    }
}
