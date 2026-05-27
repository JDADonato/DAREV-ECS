<?php

namespace Tests\Unit;

use App\Models\Announcement;
use App\Models\BookingReviewTask;
use App\Models\CalendarAvailabilityOverride;
use App\Models\FeedbackResponse;
use App\Models\MenuItem;
use App\Models\Package;
use Tests\TestCase;

class PostgresBooleanModelTest extends TestCase
{
    private string $defaultConnection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->defaultConnection = config('database.default');

        config([
            'database.default' => 'supabase',
            'database.connections.supabase.driver' => 'pgsql',
        ]);
    }

    protected function tearDown(): void
    {
        config(['database.default' => $this->defaultConnection]);

        parent::tearDown();
    }

    public function test_postgres_boolean_models_store_literals_instead_of_integers(): void
    {
        $announcement = new Announcement(['send_email' => false]);
        $task = new BookingReviewTask(['customer_visible' => true]);
        $menuItem = new MenuItem(['is_best_seller' => false, 'is_active' => true]);
        $package = new Package(['is_active' => false]);
        $override = new CalendarAvailabilityOverride(['is_locked' => true]);
        $feedback = new FeedbackResponse(['testimonial_permission' => false, 'follow_up_required' => true]);

        $this->assertSame('false', $announcement->getAttributes()['send_email']);
        $this->assertSame('true', $task->getAttributes()['customer_visible']);
        $this->assertSame('false', $menuItem->getAttributes()['is_best_seller']);
        $this->assertSame('true', $menuItem->getAttributes()['is_active']);
        $this->assertSame('false', $package->getAttributes()['is_active']);
        $this->assertSame('true', $override->getAttributes()['is_locked']);
        $this->assertSame('false', $feedback->getAttributes()['testimonial_permission']);
        $this->assertSame('true', $feedback->getAttributes()['follow_up_required']);
    }
}
