<?php

namespace Tests\Feature;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\ReportRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ReportAndAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_run_export_and_delete_report_template(): void
    {
        $admin = $this->user('Admin');

        $create = $this->actingAs($admin)
            ->postJson('/api/admin/report-templates', [
                'name' => 'Launch Readiness',
                'description' => 'High-risk launch report',
                'visibility' => 'admin',
                'layout_json' => [['id' => 'revenue_summary']],
                'filters_json' => ['range' => 'month'],
            ])
            ->assertCreated();

        $templateId = $create->json('id');

        $this->actingAs($admin)
            ->patchJson("/api/admin/report-templates/{$templateId}", [
                'name' => 'Launch Readiness Updated',
                'description' => 'Updated report',
                'visibility' => 'admin',
                'layout_json' => [['id' => 'revenue_summary']],
                'filters_json' => ['range' => 'week'],
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Launch Readiness Updated');

        $run = $this->actingAs($admin)
            ->postJson("/api/admin/report-templates/{$templateId}/run", [
                'filters' => ['range' => 'week'],
            ])
            ->assertCreated();

        $runId = $run->json('id');
        $this->assertDatabaseHas('report_runs', [
            'id' => $runId,
            'report_template_id' => $templateId,
            'created_by' => $admin->id,
            'status' => 'completed',
        ]);

        $this->actingAs($admin)
            ->get("/api/admin/report-runs/{$runId}/export?format=csv")
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $this->actingAs($admin)
            ->deleteJson("/api/admin/report-templates/{$templateId}")
            ->assertOk();

        $this->assertDatabaseMissing('report_templates', ['id' => $templateId]);
        $this->assertTrue(ReportRun::whereKey($runId)->exists());
    }

    public function test_announcement_draft_publish_archive_and_targeting_workflow(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');

        $create = $this->actingAs($marketing)
            ->postJson('/api/admin/announcements', [
                'title' => 'Menu Refresh',
                'summary' => 'New seasonal options are available.',
                'body' => 'The catering team has published new menu options.',
                'type' => 'menu_update',
                'status' => 'draft',
                'visibility' => 'specific_users',
                'specific_user_ids' => [$client->id],
                'send_email' => false,
            ])
            ->assertCreated();

        $announcementId = $create->json('id');

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcementId}/publish")
            ->assertOk()
            ->assertJsonPath('status', 'published');

        $this->actingAs($client)
            ->getJson('/api/customer/announcements')
            ->assertOk()
            ->assertJsonFragment(['id' => $announcementId]);

        $otherClient = $this->user('Client');
        $this->actingAs($otherClient)
            ->getJson('/api/customer/announcements')
            ->assertOk()
            ->assertJsonMissing(['id' => $announcementId]);

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcementId}/archive")
            ->assertOk()
            ->assertJsonPath('status', 'archived');
    }

    public function test_announcement_test_email_is_queued(): void
    {
        Mail::fake();

        $marketing = $this->user('Marketing');
        $announcement = Announcement::create([
            'title' => 'Service Notice',
            'slug' => 'service-notice',
            'summary' => 'A short notice.',
            'body' => 'A longer service notice.',
            'type' => 'service_notice',
            'status' => 'draft',
            'visibility' => 'all_customers',
            'send_email' => true,
            'created_by' => $marketing->id,
            'updated_by' => $marketing->id,
        ]);

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcement->id}/send-test", [
                'email' => 'owner@example.test',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Test email queued.');

        Mail::assertQueued(AnnouncementEmail::class);
    }

    private function user(string $role): User
    {
        return User::create([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role) . '_' . uniqid(),
            'email' => uniqid(strtolower($role) . '_') . '@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'email_verified_at' => now(),
        ]);
    }
}
