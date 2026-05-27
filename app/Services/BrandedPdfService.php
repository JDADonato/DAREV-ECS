<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\ReportRun;
use App\Support\PaymentLabels;
use Illuminate\Support\Collection;

class BrandedPdfService
{
    public function receipt(Payment $payment, Booking $booking): string
    {
        $method = PaymentLabels::method($payment->payment_method ?? null);
        $paidAt = $payment->paid_at ?? $payment->updated_at ?? $payment->created_at;
        $rows = [
            ['Receipt No.', sprintf('ECS-%d-P%d', $booking->id, $payment->id)],
            ['Booking Reference', sprintf('#%04d', $booking->id)],
            ['Client', $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username ?: 'Client'],
            ['Event', $booking->event_name ?: $booking->event_type ?: 'Booked event'],
            ['Event Date', optional($booking->event_date)->format('M j, Y') . ($booking->event_time ? ' at ' . $booking->event_time : '')],
            ['Payment Type', $this->label($payment->payment_type ?? 'Payment')],
            ['Payment Method', $method['label']],
            ['Amount', $this->money($payment->amount ?? 0)],
            ['Status', $this->label($payment->status ?? 'Pending')],
            ['Reference', $payment->paymongo_reference_number ?: $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id ?: 'Not provided'],
            ['Payment Date', optional($paidAt)->format('M j, Y g:i A') ?: 'Not recorded'],
            ['Remaining Balance', $this->money(max(0, (float) ($booking->total_cost ?? 0) - (float) $booking->payments()->whereIn('status', ['Paid', 'Verified'])->sum('amount')))],
        ];

        return $this->document('Official Receipt', 'Computer-generated receipt. No signature required.', $rows, [
            'Generated for payment verification and client records.',
            'For questions, contact Eloquente Catering through your account or official contact channels.',
        ]);
    }

    public function preparationList(Booking $booking): string
    {
        $booking->loadMissing(['user', 'assignee', 'preparationTasks']);
        $menu = collect($booking->selected_menu_array ?? [])
            ->map(fn ($item) => is_array($item) ? ($item['name'] ?? $item['dish_name'] ?? $item['title'] ?? null) : $item)
            ->filter()
            ->implode(', ');

        $rows = [
            ['Booking Reference', sprintf('#%04d', $booking->id)],
            ['Event', $booking->event_name ?: $booking->event_type ?: 'Booked event'],
            ['Client', $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username ?: 'Client'],
            ['Contact', trim(($booking->client_email ?: '') . ' ' . ($booking->client_phone ?: '')) ?: 'Not provided'],
            ['Date and Time', optional($booking->event_date)->format('M j, Y') . ($booking->event_time ? ' at ' . $booking->event_time : '')],
            ['Venue', $this->venue($booking)],
            ['Guests', number_format((int) ($booking->pax ?? 0))],
            ['Package/Menu', $menu ?: 'Menu details pending or not recorded'],
            ['Motif', $booking->color_motif ?: 'Not specified'],
            ['Special Instructions', $booking->special_instructions ?: 'None recorded'],
            ['Owner', $booking->assignee?->full_name ?: $booking->assignee?->username ?: 'Unassigned'],
        ];

        $taskLines = $booking->preparationTasks
            ->groupBy('department')
            ->flatMap(fn (Collection $tasks, string $department) => $tasks->map(fn ($task) => $department . ': ' . $task->title . ' - ' . $task->status))
            ->values()
            ->all();

        return $this->document('Event Preparation List', 'Internal preparation document.', $rows, $taskLines ?: ['No preparation tasks recorded yet.']);
    }

    public function report(ReportRun $run, array $sections): string
    {
        $rows = [
            ['Report Number', '#' . $run->id],
            ['Generated', now()->format('M j, Y g:i A')],
            ['Created By', $run->creator?->full_name ?: $run->creator?->username ?: 'Admin'],
        ];

        return $this->document('Management Report', 'Prepared for Eloquente staff review.', $rows, $sections);
    }

    public function calendar(string $title, Collection $events): string
    {
        $rows = $events->map(fn ($event) => [
            optional($event->event_date)->format('M j, Y') . ($event->event_time ? ' ' . $event->event_time : ''),
            ($event->event_name ?: $event->event_type ?: 'Booked event') . ' | ' . ($event->client_full_name ?: 'Client') . ' | ' . $this->label($event->status),
        ])->all();

        return $this->document($title, 'Event calendar export.', $rows ?: [['Events', 'No events found for the selected range.']], []);
    }

    private function document(string $title, string $subtitle, array $rows, array $notes): string
    {
        $lines = [
            'ELOQUENTE CATERING',
            $title,
            $subtitle,
            'Generated: ' . now()->format('M j, Y g:i A'),
            str_repeat('-', 72),
        ];

        foreach ($rows as $row) {
            $lines[] = str_pad((string) ($row[0] ?? ''), 22) . ' ' . (string) ($row[1] ?? '');
        }

        if ($notes) {
            $lines[] = str_repeat('-', 72);
            foreach ($notes as $note) {
                $lines[] = (string) $note;
            }
        }

        return $this->simplePdf($lines);
    }

    private function simplePdf(array $lines): string
    {
        $pages = array_chunk($this->wrap($lines), 40);
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>'];
        $pageRefs = [];
        $fontObjectId = (count($pages) * 2) + 3;

        foreach ($pages as $index => $pageLines) {
            $pageId = 3 + ($index * 2);
            $contentId = $pageId + 1;
            $pageRefs[] = "{$pageId} 0 R";
            $objects[] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {$fontObjectId} 0 R >> >> /Contents {$contentId} 0 R >>";

            $streamLines = ['BT', '/F1 11 Tf', '54 742 Td', '15 TL'];
            foreach ($pageLines as $line) {
                $streamLines[] = '(' . $this->escape($line) . ') Tj';
                $streamLines[] = 'T*';
            }
            $streamLines[] = 'ET';
            $stream = implode("\n", $streamLines);
            $objects[] = "<< /Length " . strlen($stream) . " >>\nstream\n{$stream}\nendstream";
        }

        array_splice($objects, 1, 0, ['<< /Type /Pages /Kids [' . implode(' ', $pageRefs) . '] /Count ' . count($pages) . ' >>']);
        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }

        return $pdf . "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function wrap(array $lines): array
    {
        return collect($lines)->flatMap(function ($line) {
            $line = trim(preg_replace('/\s+/', ' ', (string) $line));
            return $line === '' ? [''] : str_split($line, 88);
        })->all();
    }

    private function escape(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    }

    private function money(mixed $value): string
    {
        return 'PHP ' . number_format((float) $value, 2);
    }

    private function label(?string $value): string
    {
        return ucwords(str_replace(['_', '-'], ' ', (string) $value));
    }

    private function venue(Booking $booking): string
    {
        return collect([$booking->venue_address_line, $booking->venue_street, $booking->venue_city, $booking->venue_province, $booking->venue_zip_code])
            ->filter()
            ->implode(', ') ?: 'Venue not provided';
    }
}
