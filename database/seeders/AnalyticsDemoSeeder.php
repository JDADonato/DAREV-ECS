<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsDemoSeeder extends Seeder
{
    private const DEMO_DOMAIN = 'demo.eloquente.test';

    public function run(): void
    {
        mt_srand(20260520);

        DB::transaction(function () {
            $this->cleanGeneratedAnalyticsData();
            $this->ensureMenuVolume();
            $clients = $this->seedClients();
            $this->seedBookings($clients);
        });

        Cache::forget('admin.analytics.v3');
        Cache::forget('admin.analytics.v4');

        $this->command?->info('Seeded analytics demo data: 125 clients, 180 bookings, 540 payments, and 1,400+ booking items.');
    }

    private function cleanGeneratedAnalyticsData(): void
    {
        $bookingIds = Booking::where('client_email', 'like', '%@' . self::DEMO_DOMAIN)->pluck('id');

        if ($bookingIds->isNotEmpty()) {
            Payment::whereIn('booking_id', $bookingIds)->delete();
            BookingItem::whereIn('booking_id', $bookingIds)->delete();
            Booking::whereIn('id', $bookingIds)->delete();
        }

        User::where('email', 'like', '%@' . self::DEMO_DOMAIN)->delete();
        MenuItem::where('dish_id', 'like', 'demo_%')->delete();
    }

    private function ensureMenuVolume(): void
    {
        $targets = [
            'starter' => 22,
            'main' => 36,
            'side' => 20,
            'dessert' => 18,
            'drink' => 14,
        ];

        $names = [
            'starter' => ['Roasted Squash Soup', 'Citrus Garden Salad', 'Spinach Artichoke Dip', 'Tomato Basil Bisque', 'Mini Beef Empanadas', 'Cucumber Canapes', 'Smoked Chicken Tartlets', 'Shrimp Cocktail Cups', 'Mushroom Vol-au-Vent', 'Crispy Tofu Bites', 'Herbed Potato Croquettes', 'Asian Slaw Cups'],
            'main' => ['Chicken Roulade', 'Beef Caldereta', 'Pork Medallions', 'Baked Salmon', 'Herb Roasted Chicken', 'Kare-Kare Beef', 'Fish Florentine', 'Pork Asado', 'Chicken Cordon Bleu', 'Beef Stroganoff', 'Garlic Prawn Pasta', 'Lengua Estofado', 'Soy Ginger Fish', 'Pork BBQ Skewers', 'Truffle Cream Chicken', 'Vegetable Lasagna'],
            'side' => ['Garlic Butter Rice', 'Herbed Mashed Potato', 'Vegetable Pilaf', 'Buttered Corn', 'Roasted Mixed Vegetables', 'Creamy Macaroni', 'Pancit Canton', 'Potato Gratin', 'Spanish Rice', 'Sauteed Green Beans'],
            'dessert' => ['Mango Panna Cotta', 'Mini Cheesecake', 'Leche Flan Cups', 'Chocolate Mousse', 'Fruit Tartlets', 'Ube Panna Cotta', 'Brazo de Mercedes', 'Tiramisu Cups', 'Pandan Jelly', 'Banoffee Cups'],
            'drink' => ['Calamansi Cooler', 'Cucumber Lemonade', 'Four Seasons Juice', 'House Iced Tea', 'Blue Lemonade', 'Mango Citrus Punch', 'Brewed Coffee Station', 'Hot Chocolate'],
        ];

        $images = [
            'starter' => 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400',
            'main' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400',
            'side' => 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&q=80&w=400',
            'dessert' => 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400',
            'drink' => 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=400',
        ];

        foreach ($targets as $category => $target) {
            $current = MenuItem::where('category', $category)->count();
            $needed = max(0, $target - $current);

            for ($i = 0; $i < $needed; $i++) {
                $baseName = $names[$category][$i % count($names[$category])];
                $variant = intdiv($i, count($names[$category])) + 1;
                $name = $variant > 1 ? "{$baseName} {$variant}" : $baseName;

                DB::table('menu_items')->insert([
                    'dish_id' => 'demo_' . $category . '_' . str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                    'name' => $name,
                    'category' => $category,
                    'cost_per_head' => $this->menuPrice($category, $i),
                    'price_adj' => in_array($category, ['main', 'dessert'], true) && $i % 5 === 0 ? 20 : 0,
                    'image' => $images[$category],
                    'description' => $this->menuDescription($category),
                    'is_best_seller' => $i % 7 === 0 ? DB::raw('true') : DB::raw('false'),
                    'is_active' => DB::raw('true'),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function seedClients(): array
    {
        $firstNames = ['Maria', 'James', 'Angela', 'Nina', 'Rafael', 'Bea', 'Carlo', 'Trisha', 'Miguel', 'Sofia', 'Paolo', 'Isabel', 'Marco', 'Camille', 'Luis', 'Andrea', 'Enzo', 'Patricia', 'Daniel', 'Mika'];
        $lastNames = ['Santos', 'Reyes', 'Cruz', 'Lim', 'Tan', 'Mendoza', 'Garcia', 'Dela Cruz', 'Villanueva', 'Sy', 'Ramos', 'Torres', 'Navarro', 'Chua', 'Aquino', 'Bautista', 'Castillo', 'Gonzales', 'Rivera', 'Yu'];
        $clients = [];

        for ($i = 1; $i <= 125; $i++) {
            $first = $firstNames[($i - 1) % count($firstNames)];
            $last = $lastNames[(int) floor(($i - 1) / count($firstNames)) % count($lastNames)];
            $name = "{$first} {$last}";
            $clients[] = [
                'name' => $name,
                'user' => User::create([
                    'username' => 'ecs_demo_client_' . str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'password' => 'password123',
                    'role' => 'Client',
                    'email' => 'client' . str_pad((string) $i, 3, '0', STR_PAD_LEFT) . '@' . self::DEMO_DOMAIN,
                    'phone' => '09' . str_pad((string) (170000000 + $i * 713), 9, '0', STR_PAD_LEFT),
                    'email_verified_at' => now(),
                    'created_at' => now()->subDays(260 - ($i % 180)),
                    'updated_at' => now(),
                ]),
            ];
        }

        return $clients;
    }

    private function seedBookings(array $clients): void
    {
        $packages = Package::all()->values();
        $eventTypes = EventType::all()->values();
        $menuItems = MenuItem::where('is_active', DB::raw('true'))->get()->groupBy('category');
        $cities = ['Makati City', 'Quezon City', 'Pasig City', 'Taguig City', 'San Juan', 'Paranaque City', 'Mandaluyong', 'Alabang', 'Antipolo City', 'Tagaytay City', 'Santa Rosa'];
        $venues = ['Grand Pavilion', 'Glass Garden', 'Corporate Hall', 'Lakeside Events Place', 'Heritage Ballroom', 'Skyline Function Room', 'Vista Tent', 'Garden Courtyard'];
        $monthOffsets = collect(range(-10, 8))->flatMap(function ($offset) {
            $month = Carbon::now()->startOfMonth()->addMonths($offset)->month;
            return in_array($month, [5, 6, 11, 12], true) ? [$offset, $offset, $offset] : [$offset];
        })->values();

        for ($i = 0; $i < 180; $i++) {
            $client = $clients[$i % count($clients)];
            $package = $packages[$i % max($packages->count(), 1)] ?? null;
            $eventType = $eventTypes[($i * 3) % max($eventTypes->count(), 1)] ?? null;
            $eventDate = Carbon::now()->startOfMonth()
                ->addMonths($monthOffsets[$i % $monthOffsets->count()])
                ->addDays(3 + (($i * 5) % 24));
            $city = $cities[$i % count($cities)];
            $pax = $this->paxForEvent($eventType?->slug ?? '', $i);
            $base = (int) ($package?->base_price_per_head ?? 650);
            $transport = in_array($city, ['Antipolo City', 'Tagaytay City', 'Santa Rosa'], true) ? 8500 + (($i % 3) * 1500) : 2500 + (($i % 4) * 700);
            $labor = $pax >= 280 ? 16000 : ($pax >= 160 ? 9500 : 4500);
            $stylePremium = in_array($eventType?->slug, ['formal-wedding', 'debut'], true) ? 18000 : 0;
            $total = ($base * $pax) + $transport + $labor + $stylePremium;
            $status = $this->statusForDate($eventDate, $i);

            $booking = Booking::create([
                'user_id' => $client['user']->id,
                'event_date' => $eventDate->toDateString(),
                'event_time' => ['10:00', '12:00', '15:00', '18:00'][$i % 4],
                'pax' => $pax,
                'budget' => $total,
                'package_id' => $package ? (string) $package->id : null,
                'event_type_id' => $eventType?->id,
                'event_type' => $eventType?->label ?? 'Social Event',
                'client_full_name' => $client['name'],
                'venue_address_line' => ($i + 18) . ' ' . $venues[$i % count($venues)],
                'venue_street' => 'Events Avenue',
                'venue_city' => $city,
                'venue_province' => in_array($city, ['Tagaytay City', 'Santa Rosa'], true) ? 'Cavite/Laguna Area' : 'Metro Manila',
                'venue_zip_code' => (string) (1000 + ($i % 80)),
                'client_email' => $client['user']->email,
                'client_phone' => $client['user']->phone,
                'reservation_time' => '16:00',
                'serving_time' => ['12:30', '18:30', '19:00'][$i % 3],
                'event_timeline' => "Ingress 4 hours before service\nGuest arrival 1 hour before service\nBuffet opens after program cue",
                'color_motif' => ['burgundy and gold', 'sage and ivory', 'navy and champagne', 'dusty blue and white'][$i % 4],
                'total_cost' => $total,
                'status' => $status,
                'selected_menu' => json_encode([]),
                'live_status' => $status === 'Completed' ? 'Completed' : ($status === 'Confirmed' ? 'Payment Verified' : 'Not Started'),
                'transport_fee' => $transport,
                'labor_surcharge' => $labor,
                'created_at' => $eventDate->copy()->subDays(28 + ($i % 42)),
                'updated_at' => now()->subDays($i % 9),
            ]);

            $selected = $this->attachMenuItems($booking, $menuItems, $i);
            $booking->update(['selected_menu' => json_encode($selected)]);
            $this->seedPaymentPlan($booking, $status);
        }
    }

    private function attachMenuItems(Booking $booking, $menuItems, int $index): array
    {
        $structure = ['starter' => 2, 'main' => 3, 'side' => 1, 'dessert' => 1, 'drink' => 1];
        $selected = [];

        foreach ($structure as $category => $count) {
            $items = ($menuItems[$category] ?? collect())->values();
            $selected[$category] = [];

            for ($i = 0; $i < $count && $items->isNotEmpty(); $i++) {
                $item = $items[($index + ($i * 7)) % $items->count()];
                $selected[$category][] = [
                    'id' => $item->id,
                    'name' => $item->name,
                    'costPerHead' => (float) $item->cost_per_head,
                    'priceAdj' => (float) $item->price_adj,
                ];

                BookingItem::create([
                    'booking_id' => $booking->id,
                    'menu_item_id' => $item->id,
                    'quantity' => $booking->pax,
                ]);
            }
        }

        return $selected;
    }

    private function seedPaymentPlan(Booking $booking, string $status): void
    {
        $eventDate = Carbon::parse($booking->event_date);
        $plan = [
            ['Reservation', 0.10, $eventDate->copy()->subDays(45)],
            ['DownPayment', 0.70, $eventDate->copy()->subDays(30)],
            ['Final', 0.20, $eventDate->copy()->subDays(10)],
        ];

        foreach ($plan as [$type, $ratio, $dueDate]) {
            $settled = $status === 'Completed'
                || ($status === 'Confirmed' && $type !== 'Final')
                || ($status === 'Confirmed' && $dueDate->isPast() && $type === 'Final' && $booking->id % 4 !== 0);

            Payment::create([
                'booking_id' => $booking->id,
                'amount' => round((float) $booking->total_cost * $ratio, 2),
                'payment_method' => $settled ? ['Bank Transfer', 'PayMongo Checkout', 'GCash'][$booking->id % 3] : 'Pending',
                'status' => $settled ? 'Verified' : 'Pending',
                'payment_type' => $type,
                'due_date' => $dueDate->toDateString(),
                'verified_by' => $settled ? 'accounting' : null,
                'verified_at' => $settled ? $dueDate->copy()->addDay() : null,
                'created_at' => $dueDate->copy()->subDays(2),
                'updated_at' => $settled ? $dueDate->copy()->addDay() : now(),
            ]);
        }
    }

    private function statusForDate(Carbon $eventDate, int $index): string
    {
        if ($eventDate->isPast()) {
            return $index % 12 === 0 ? 'Cancelled' : 'Completed';
        }

        return $index % 5 === 0 ? 'Pending' : 'Confirmed';
    }

    private function paxForEvent(string $slug, int $index): int
    {
        $ranges = [
            'formal-wedding' => [120, 380],
            'debut' => [90, 240],
            'corporate-seminar' => [60, 320],
            'family-reunion' => [55, 180],
            'casual-birthday' => [45, 150],
        ];
        [$min, $max] = $ranges[$slug] ?? [50, 220];

        return $min + (($index * 23) % max($max - $min, 1));
    }

    private function menuPrice(string $category, int $index): int
    {
        $ranges = [
            'starter' => [38, 78],
            'main' => [72, 165],
            'side' => [28, 58],
            'dessert' => [32, 72],
            'drink' => [24, 46],
        ];
        [$min, $max] = $ranges[$category];

        return $min + (($index * 7) % ($max - $min + 1));
    }

    private function menuDescription(string $category): string
    {
        return [
            'starter' => 'A light opening dish prepared for plated or buffet service.',
            'main' => 'A hearty event entree designed for reliable buffet holding and service flow.',
            'side' => 'A balanced side dish that pairs cleanly with classic Filipino and continental mains.',
            'dessert' => 'A portion-friendly dessert prepared for smooth event service.',
            'drink' => 'A refreshing beverage option suitable for lunch, dinner, and reception service.',
        ][$category];
    }
}
