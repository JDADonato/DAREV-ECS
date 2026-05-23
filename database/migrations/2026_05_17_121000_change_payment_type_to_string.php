<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE payments ALTER COLUMN payment_type TYPE VARCHAR(255) USING payment_type::text');
    }

    public function down(): void
    {
        DB::table('payments')
            ->whereNotIn('payment_type', ['Reservation', 'DownPayment', 'Final'])
            ->update(['payment_type' => 'Final']);

        DB::statement("ALTER TABLE payments ALTER COLUMN payment_type TYPE VARCHAR(255) USING payment_type::text");
    }
};
