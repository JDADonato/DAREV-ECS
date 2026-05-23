<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReportRunResource;
use App\Http\Resources\ReportTemplateResource;
use App\Models\ReportRun;
use App\Models\ReportTemplate;
use App\Services\AdminReportService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(private readonly AdminReportService $reports)
    {
    }

    public function widgets()
    {
        return response()->json($this->reports->widgetDefinitions());
    }

    public function preview(Request $request)
    {
        $payload = $request->validate([
            'widgets' => 'nullable|array',
            'widgets.*' => 'string',
            'filters' => 'nullable|array',
        ]);

        return response()->json([
            'widgets' => $this->reports->preview($payload['widgets'] ?? [], $payload['filters'] ?? []),
        ]);
    }

    public function templates()
    {
        return response()->json(ReportTemplateResource::collection(ReportTemplate::query()
            ->orderByDesc('updated_at')
            ->get())->resolve());
    }

    public function storeTemplate(Request $request)
    {
        $payload = $this->validateTemplate($request);
        $template = ReportTemplate::create([
            ...$payload,
            'created_by' => Auth::id(),
            'visibility' => $payload['visibility'] ?? 'admin',
        ]);

        return response()->json((new ReportTemplateResource($template))->resolve(), 201);
    }

    public function updateTemplate(Request $request, ReportTemplate $template)
    {
        $template->update($this->validateTemplate($request));

        return response()->json((new ReportTemplateResource($template->fresh()))->resolve());
    }

    public function destroyTemplate(ReportTemplate $template)
    {
        $template->delete();

        return ApiResponse::message('Report template deleted.');
    }

    public function run(Request $request, ReportTemplate $template)
    {
        $payload = $request->validate([
            'filters' => 'nullable|array',
        ]);

        $filters = array_filter($payload['filters'] ?? $template->filters_json ?? [], fn ($value) => $value !== null && $value !== '');
        $widgets = collect($template->layout_json ?? [])
            ->map(fn ($item) => is_array($item) ? ($item['id'] ?? null) : $item)
            ->filter()
            ->values()
            ->all();

        $snapshot = $this->reports->preview($widgets, $filters);

        $run = ReportRun::create([
            'report_template_id' => $template->id,
            'created_by' => Auth::id(),
            'status' => 'completed',
            'parameters_json' => ['filters' => $filters, 'widgets' => $widgets],
            'result_snapshot_json' => $snapshot,
        ]);

        return response()->json((new ReportRunResource($run))->resolve(), 201);
    }

    public function export(ReportRun $run): StreamedResponse
    {
        $filename = 'eloquente-report-' . $run->id . '.csv';
        $snapshot = $run->result_snapshot_json ?? [];

        return response()->streamDownload(function () use ($snapshot) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Widget', 'Metric', 'Value', 'Extra']);

            foreach ($snapshot as $widget) {
                $title = $widget['id'] ?? 'widget';
                $data = $widget['data'] ?? [];

                foreach ($this->flattenWidgetRows($data) as $row) {
                    fputcsv($handle, [$title, $row['metric'], $row['value'], $row['extra']]);
                }
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            'visibility' => 'nullable|string|max:40',
            'layout_json' => 'required|array|min:1',
            'filters_json' => 'nullable|array',
        ]);
    }

    private function flattenWidgetRows(array $data): array
    {
        if (isset($data['rows']) && is_array($data['rows'])) {
            return collect($data['rows'])->flatMap(function ($row) {
                if (!is_array($row)) {
                    return [['metric' => 'value', 'value' => $row, 'extra' => '']];
                }

                $label = $row['label'] ?? $row['name'] ?? $row['client'] ?? $row['date'] ?? 'row';
                return collect($row)
                    ->reject(fn ($value, $key) => in_array($key, ['label', 'name', 'client'], true))
                    ->map(fn ($value, $key) => [
                        'metric' => $label . ' - ' . $key,
                        'value' => is_scalar($value) ? $value : json_encode($value),
                        'extra' => '',
                    ])
                    ->values();
            })->values()->all();
        }

        return collect($data)
            ->reject(fn ($value) => is_array($value))
            ->map(fn ($value, $key) => ['metric' => $key, 'value' => $value, 'extra' => ''])
            ->values()
            ->all();
    }
}
