<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Models\BusinessRule;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed default users
        $this->seedDefaultUsers();

        // Seed event types
        $this->seedEventTypes();

        // Seed menu items (dishes)
        $this->seedMenuItems();

        // Seed packages
        $this->seedPackages();

        // Seed business rules
        $this->seedBusinessRules();

        $this->command->info('✅ Database seeded successfully!');
    }

    private function seedDefaultUsers(): void
    {
        $defaultUsers = [
            ['username' => 'admin',      'role' => 'Admin'],
            ['username' => 'marketing',  'role' => 'Marketing'],
            ['username' => 'accounting', 'role' => 'Accounting'],
            ['username' => 'client',     'role' => 'Client'],
        ];

        foreach ($defaultUsers as $userData) {
            User::firstOrCreate(
                ['username' => $userData['username']],
                [
                    'password' => 'password123',
                    'role'     => $userData['role'],
                ]
            );
        }

        $this->command->info('Seeded 4 default users');
    }

    private function seedEventTypes(): void
    {
        $events = [
            ['slug' => 'formal-wedding', 'label' => 'Formal Wedding', 'icon' => 'wedding', 'description' => 'Elegant ceremonies & receptions', 'image' => 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'debut', 'label' => 'Debut', 'icon' => 'crown', 'description' => '18th birthday celebrations', 'image' => 'https://images.unsplash.com/photo-1541086095944-f4b5412d3666?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'casual-birthday', 'label' => 'Casual Birthday', 'icon' => 'cake', 'description' => 'Fun birthday parties', 'image' => 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'corporate-seminar', 'label' => 'Corporate Seminar', 'icon' => 'briefcase', 'description' => 'Professional events & conferences', 'image' => 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'family-reunion', 'label' => 'Family Reunion', 'icon' => 'users', 'description' => 'Bringing families together', 'image' => 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'anniversary', 'label' => 'Anniversary', 'icon' => 'heart', 'description' => 'Celebrating milestones', 'image' => 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'graduation', 'label' => 'Graduation', 'icon' => 'academic', 'description' => 'Academic celebrations', 'image' => 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800&auto=format&fit=crop'],
            ['slug' => 'other', 'label' => 'Other', 'icon' => 'sparkles', 'description' => 'Any special occasion', 'image' => 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=800&auto=format&fit=crop'],
        ];

        foreach ($events as $event) {
            EventType::firstOrCreate(['slug' => $event['slug']], $event);
        }

        $this->command->info('Seeded 8 event types');
    }

    private function seedMenuItems(): void
    {
        $items = [
            // Starters
            ['dish_id' => 'sup1', 'name' => 'Bacon and Mushroom Soup',   'category' => 'starter', 'cost_per_head' => 50,  'price_adj' => 0,  'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1629853346988-cb949bc5392d?auto=format&fit=crop&q=80&w=400', 'description' => 'Creamy mushroom soup topped with crispy bacon bits.'],
            ['dish_id' => 'sup2', 'name' => 'Corn Chowder Soup',         'category' => 'starter', 'cost_per_head' => 45,  'price_adj' => 0,  'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1629853346988-cb949bc5392d?auto=format&fit=crop&q=80&w=400', 'description' => 'Hearty corn soup with vegetables.'],
            ['dish_id' => 'app1', 'name' => 'Assorted Canapés',          'category' => 'starter', 'cost_per_head' => 55,  'price_adj' => 0,  'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&q=80&w=400', 'description' => 'French bread with Crab Sticks, Tuna, and Egg spread.'],
            ['dish_id' => 'app2', 'name' => 'Honey Beef Pita',           'category' => 'starter', 'cost_per_head' => 70,  'price_adj' => 20, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&q=80&w=400', 'description' => 'Savory sweet beef served on mini pita bread.'],
            ['dish_id' => 'sal1', 'name' => 'Garden Fresh Salad',        'category' => 'starter', 'cost_per_head' => 40,  'price_adj' => 0,  'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400', 'description' => 'Fresh lettuce, tomato, carrots, cucumber, pineapple.'],
            ['dish_id' => 'app3', 'name' => 'Lumpiang Shanghai',         'category' => 'starter', 'cost_per_head' => 70,  'price_adj' => 0,  'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&q=80&w=400', 'description' => 'Crispy fried spring rolls with savory pork filling.'],
            
            // Mains - Beef
            ['dish_id' => 'main1', 'name' => 'Beef Sirloin w/ Thick Mushroom Sauce', 'category' => 'main', 'cost_per_head' => 120, 'price_adj' => 50, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&q=80&w=400', 'description' => 'Tender sirloin slices in rich mushroom gravy.'],
            ['dish_id' => 'main2', 'name' => 'Braised Beef with Red Wine',           'category' => 'main', 'cost_per_head' => 130, 'price_adj' => 60, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&q=80&w=400', 'description' => 'Slow-cooked beef infused with red wine sauce.'],
            ['dish_id' => 'main3', 'name' => 'Roast Beef',                            'category' => 'main', 'cost_per_head' => 150, 'price_adj' => 100, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&q=80&w=400', 'description' => 'Premium roast beef with gravy.'],
            ['dish_id' => 'main15', 'name' => 'Beef Garlic Salpicao',                 'category' => 'main', 'cost_per_head' => 130, 'price_adj' => 60, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400', 'description' => 'Garlicky beef cubes sautéed in olive oil.'],
            ['dish_id' => 'main16', 'name' => 'Beef Tenderloin with Olives',          'category' => 'main', 'cost_per_head' => 140, 'price_adj' => 80, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&q=80&w=400', 'description' => 'Succulent tenderloin steak with olives.'],
            
            // Mains - Pork
            ['dish_id' => 'main4', 'name' => 'Honey Cured Pork Belly',               'category' => 'main', 'cost_per_head' => 70,  'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&q=80&w=400', 'description' => 'Sweet and savory cured pork belly slices.'],
            ['dish_id' => 'main5', 'name' => 'Mild Spicy Pork Belly',                'category' => 'main', 'cost_per_head' => 70,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=400', 'description' => 'Pork belly with a kick of spice.'],
            ['dish_id' => 'main17', 'name' => 'Pork Tonkatsu',                        'category' => 'main', 'cost_per_head' => 75,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1604259597308-4e9941e9fc13?auto=format&fit=crop&q=80&w=400', 'description' => 'Breaded deep-fried pork cutlet.'],
            ['dish_id' => 'main18', 'name' => 'Pork Belly with Hickory Sauce',        'category' => 'main', 'cost_per_head' => 75,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&q=80&w=400', 'description' => 'Smoky hickory BBQ flavored pork belly.'],
            
            // Mains - Chicken
            ['dish_id' => 'main6', 'name' => 'Grilled Chicken w/ Mango Chutney',     'category' => 'main', 'cost_per_head' => 70,  'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=400', 'description' => 'Grilled chicken topped with sweet mango chutney.'],
            ['dish_id' => 'main7', 'name' => 'Chicken Teriyaki',                     'category' => 'main', 'cost_per_head' => 70,  'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1552590635-27c2c2128abf?auto=format&fit=crop&q=80&w=400', 'description' => 'Grilled chicken glaze with sesame seeds.'],
            ['dish_id' => 'main8', 'name' => 'Garlic Parmesan Chicken',              'category' => 'main', 'cost_per_head' => 75,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1604908555234-2c49cbf2c8ce?auto=format&fit=crop&q=80&w=400', 'description' => 'Chicken fillets with rich cheese sauce.'],
            ['dish_id' => 'main9', 'name' => 'Classic Fried Chicken',                'category' => 'main', 'cost_per_head' => 65,  'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400', 'description' => 'Golden crispy fried chicken.'],
            ['dish_id' => 'main19', 'name' => 'Grilled Chicken w/ Pesto Sauce',       'category' => 'main', 'cost_per_head' => 75,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1600850056064-a8b380df8395?auto=format&fit=crop&q=80&w=400', 'description' => 'Grilled chicken covered in herbaceous pesto.'],
            ['dish_id' => 'main20', 'name' => 'Roasted Chicken Fillet w/ Italian Herbs', 'category' => 'main', 'cost_per_head' => 75, 'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&q=80&w=400', 'description' => 'Oven-roasted chicken with aromatic italian seasoning.'],
            
            // Mains - Seafood
            ['dish_id' => 'main10', 'name' => 'Grilled Fish with Lemon Butter',       'category' => 'main', 'cost_per_head' => 80,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1519708227418-c8fd9a3a2720?auto=format&fit=crop&q=80&w=400', 'description' => 'Lightly grilled fish with zesty lemon butter sauce.'],
            ['dish_id' => 'main11', 'name' => 'Pan Fried Fish w/ Baked Tomato',       'category' => 'main', 'cost_per_head' => 80,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1467003909585-2f8a7270028d?auto=format&fit=crop&q=80&w=400', 'description' => 'Fish fillet topped with baked tomato and onions.'],
            ['dish_id' => 'main12', 'name' => 'Sweet & Sour Fish w/ Tofu',            'category' => 'main', 'cost_per_head' => 75,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1551608771-8889a764720e?auto=format&fit=crop&q=80&w=400', 'description' => 'Fish fillet with tofu in sweet and sour sauce.'],
            ['dish_id' => 'main21', 'name' => 'Fish Tempura w/ Sweet Corn Salsa',     'category' => 'main', 'cost_per_head' => 80,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1615141982880-19ed7e6656fa?auto=format&fit=crop&q=80&w=400', 'description' => 'Crispy battered fish served with refreshing corn salsa.'],
            
            // Mains - Pasta
            ['dish_id' => 'main13', 'name' => 'Baked Beef Pasta Pomodoro',            'category' => 'main', 'cost_per_head' => 65,  'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=400', 'description' => 'Baked pasta with rich tomato beef sauce.'],
            ['dish_id' => 'main14', 'name' => 'Shrimp Aglio Olio',                    'category' => 'main', 'cost_per_head' => 85,  'price_adj' => 20, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=400', 'description' => 'Oil-based pasta with shrimp and garlic.'],
            
            // Sides
            ['dish_id' => 'side1', 'name' => 'Steamed Rice',                         'category' => 'side', 'cost_per_head' => 25,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&q=80&w=400', 'description' => 'Plain steamed white rice.'],
            ['dish_id' => 'side2', 'name' => 'Buttered Marble Potato & Beans',       'category' => 'side', 'cost_per_head' => 35,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1628046830588-f54261899175?auto=format&fit=crop&q=80&w=400', 'description' => 'Sautéed marble potatoes and french beans.'],
            ['dish_id' => 'side3', 'name' => 'Broccoli & Mushroom Casserole',        'category' => 'side', 'cost_per_head' => 45,  'price_adj' => 20, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1627915934522-83c9b7e7135e?auto=format&fit=crop&q=80&w=400', 'description' => 'Baked broccoli and mushrooms in cream sauce.'],
            ['dish_id' => 'side4', 'name' => 'Four Seasons Vegetables',              'category' => 'side', 'cost_per_head' => 30,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&q=80&w=400', 'description' => 'Mixed vegetables stir-fry.'],
            ['dish_id' => 'side5', 'name' => 'Mandarin Vegetables w/ Shitake',       'category' => 'side', 'cost_per_head' => 35,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1603569283847-aa295f0d016a?auto=format&fit=crop&q=80&w=400', 'description' => 'Vegetable stir-fry with shitake mushrooms.'],
            ['dish_id' => 'side6', 'name' => 'Corn & Carrots in Pepper Sauce',       'category' => 'side', 'cost_per_head' => 30,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1551529563-9dd60914f3ff?auto=format&fit=crop&q=80&w=400', 'description' => 'Sweet corn and carrots in pepper oyster sauce.'],
            ['dish_id' => 'side7', 'name' => 'Cheesy Buttered Potato Marble',        'category' => 'side', 'cost_per_head' => 35,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1600551711229-2e70e309540b?auto=format&fit=crop&q=80&w=400', 'description' => 'Potatoes coated in cheese and butter.'],
            ['dish_id' => 'side8', 'name' => 'Cheesy Buttered Corn & Potato',        'category' => 'side', 'cost_per_head' => 35,  'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1600551711229-2e70e309540b?auto=format&fit=crop&q=80&w=400', 'description' => 'Corn and marble potatoes in cheese butter.'],
            
            // Desserts
            ['dish_id' => 'des1', 'name' => 'Coffee Jello',                         'category' => 'dessert', 'cost_per_head' => 30, 'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=400', 'description' => 'Coffee flavored jelly dessert.'],
            ['dish_id' => 'des2', 'name' => 'Creamy Buko Lychee',                   'category' => 'dessert', 'cost_per_head' => 40, 'price_adj' => 20, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1624362772714-93dc44fd3c2c?auto=format&fit=crop&q=80&w=400', 'description' => 'Young coconut and lychee in cream.'],
            ['dish_id' => 'des3', 'name' => 'Mango Tapioca',                        'category' => 'dessert', 'cost_per_head' => 35, 'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1506822904562-bb443d3a049d?auto=format&fit=crop&q=80&w=400', 'description' => 'Sweet mango cubes with tapioca pearls.'],
            ['dish_id' => 'des4', 'name' => 'Brownies / Butterscotch',              'category' => 'dessert', 'cost_per_head' => 30, 'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1606313564200-e75d5e30476d?auto=format&fit=crop&q=80&w=400', 'description' => 'Chewy chocolate brownies or butterscotch bars.'],
            
            // Drinks
            ['dish_id' => 'dr1', 'name' => 'Bottomless Iced Tea',                  'category' => 'drink', 'cost_per_head' => 25, 'price_adj' => 0, 'is_best_seller' => true,  'image' => 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&q=80&w=400', 'description' => 'House blend iced tea.'],
            ['dish_id' => 'dr2', 'name' => 'Red Tea / Pineapple Orange',           'category' => 'drink', 'cost_per_head' => 30, 'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&q=80&w=400', 'description' => 'Selection of refreshing fruit drinks.'],
            ['dish_id' => 'dr3', 'name' => 'Brewed Coffee',                        'category' => 'drink', 'cost_per_head' => 30, 'price_adj' => 0, 'is_best_seller' => false, 'image' => 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=400', 'description' => 'Hot brewed coffee station.'],
        ];

        foreach ($items as $item) {
            MenuItem::firstOrCreate(['name' => $item['name']], $item);
        }

        $this->command->info('Seeded 45+ menu items');
    }

    private function seedPackages(): void
    {
        $packages = [
            [
                'name' => 'Wedding & Debut Anthurium',
                'type' => 'wedding',
                'base_price_per_head' => 850,
                'minimum_pax' => 100,
                'description' => 'Premium wedding package including elegant styling and comprehensive amenities.',
                'inclusions' => ['Elegant Backdrop & Floral Arrangement', 'Presidential Table Set-Up', 'Tiffany Chairs with Motif Ribbon', '3-Layer Fondant Cake', 'Professional Emcee & Bridal Car', 'Bottle of Wine for Toasting'],
                'menu_structure' => ['starters' => 2, 'mains' => 4, 'sides' => 1, 'desserts' => 1, 'drinks' => 1],
            ],
            [
                'name' => 'Corporate Standard',
                'type' => 'corporate',
                'base_price_per_head' => 650,
                'minimum_pax' => 30,
                'description' => 'Professional catering for seminars, conferences, and corporate events.',
                'inclusions' => ['Buffet Service Setup', 'Uniformed Waiters', 'Round Tables with Linens', 'Purified Drinking Water', 'Ice for Drinks'],
                'menu_structure' => ['starters' => 1, 'mains' => 3, 'sides' => 1, 'desserts' => 1, 'drinks' => 1],
            ],
            [
                'name' => 'Social Celebration',
                'type' => 'social',
                'base_price_per_head' => 550,
                'minimum_pax' => 50,
                'description' => 'Perfect for birthdays, reunions, and casual gatherings.',
                'inclusions' => ['Basic Balloon Decor', 'Buffet Setup', 'Cake Table', 'Sound System Basic'],
                'menu_structure' => ['starters' => 1, 'mains' => 2, 'sides' => 1, 'desserts' => 1, 'drinks' => 1],
            ],
        ];

        foreach ($packages as $package) {
            Package::firstOrCreate(['name' => $package['name']], $package);
        }

        $this->command->info('Seeded 3 packages');
    }

    private function seedBusinessRules(): void
    {
        BusinessRule::firstOrCreate(['id' => 1], [
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 7,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 30,
            'is_active' => true,
        ]);

        $this->command->info('Seeded business rules');
    }
}
