<?php

namespace App\Http\Controllers;

use App\Models\BusinessRule;
use App\Models\BusinessSetting;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function businessSettings()
    {
        $settings = BusinessSetting::query()
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(fn ($items) => $items->mapWithKeys(fn ($item) => [$item->key => $item->value]));

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function updateBusinessSettings(Request $request)
    {
        $data = $request->validate([
            'group' => ['required', 'string', 'max:80'],
            'settings' => ['required', 'array'],
        ]);

        foreach ($data['settings'] as $key => $value) {
            BusinessSetting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_array($value) ? $value : ['value' => $value],
                    'group' => $data['group'],
                    'updated_by' => $request->user()?->id,
                ]
            );
        }

        return response()->json([
            'message' => 'Settings updated successfully.',
            'settings' => BusinessSetting::where('group', $data['group'])->get()->mapWithKeys(fn ($item) => [$item->key => $item->value]),
        ]);
    }

    public function paymentRules()
    {
        return response()->json(BusinessRule::getActive());
    }

    public function updatePaymentRules(Request $request)
    {
        $data = $request->validate([
            'reservation_fee_percentage' => 'required|numeric|min:0|max:100',
            'downpayment_percentage' => 'required|numeric|min:0|max:100',
            'final_payment_percentage' => 'required|numeric|min:0|max:100',
            'reservation_validity_hours' => 'required|integer|min:1|max:720',
            'downpayment_due_days' => 'required|integer|min:1|max:365',
            'final_payment_due_days' => 'required|integer|min:1|max:365',
        ]);

        $total = (float) $data['reservation_fee_percentage']
            + (float) $data['downpayment_percentage']
            + (float) $data['final_payment_percentage'];

        if (round($total, 2) !== 100.00) {
            return response()->json(['error' => 'Payment tranche percentages must total 100%.'], 422);
        }

        if ((int) $data['final_payment_due_days'] >= (int) $data['downpayment_due_days']) {
            return response()->json(['error' => 'Final payment due days must be less than down payment due days.'], 422);
        }

        $rule = BusinessRule::getActive();
        $rule->update($data);

        return response()->json(['message' => 'Payment rules updated successfully.', 'rules' => $rule->fresh()]);
    }

    public function createPackage(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|max:255|exists:event_types,slug',
            'package_category' => 'nullable|string|max:255',
            'event_type_slugs' => 'nullable',
            'base_price_per_head' => 'required|numeric|min:0',
            'minimum_pax' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'inclusions' => 'nullable',
            'amenities' => 'nullable',
            'applicable_setups' => 'nullable',
            'menu_structure' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $data['inclusions'] = $this->normalizeLines($data['inclusions'] ?? []);
        $data['amenities'] = $this->normalizeLines($data['amenities'] ?? []);
        $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups'] ?? []);
        $data['event_type_slugs'] = $this->normalizeSlugs($data['event_type_slugs'] ?? [$data['type']]);
        $data['package_category'] = $data['package_category'] ?? 'standard';
        $data['menu_structure'] = $this->normalizeMenuStructure($data['menu_structure'] ?? []);
        $data['is_active'] = $data['is_active'] ?? true;

        $package = Package::create($data);

        return response()->json($package, 201);
    }

    public function updatePackage(Request $request, int $id)
    {
        $package = Package::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|string|max:255|exists:event_types,slug',
            'package_category' => 'nullable|string|max:255',
            'event_type_slugs' => 'nullable',
            'base_price_per_head' => 'sometimes|required|numeric|min:0',
            'minimum_pax' => 'sometimes|required|integer|min:1',
            'description' => 'nullable|string',
            'inclusions' => 'nullable',
            'amenities' => 'nullable',
            'applicable_setups' => 'nullable',
            'menu_structure' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('inclusions', $data)) {
            $data['inclusions'] = $this->normalizeLines($data['inclusions']);
        }
        if (array_key_exists('amenities', $data)) {
            $data['amenities'] = $this->normalizeLines($data['amenities']);
        }
        if (array_key_exists('applicable_setups', $data)) {
            $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups']);
        }
        if (array_key_exists('event_type_slugs', $data)) {
            $data['event_type_slugs'] = $this->normalizeSlugs($data['event_type_slugs']);
        }
        if (array_key_exists('menu_structure', $data)) {
            $data['menu_structure'] = $this->normalizeMenuStructure($data['menu_structure']);
        }

        $package->update($data);

        return response()->json(['message' => 'Package updated successfully.', 'package' => $package->fresh()]);
    }

    public function updateDishPricing(Request $request, int $id)
    {
        $data = $request->validate([
            'cost_per_head' => 'required|numeric|min:0',
            'price_adj' => 'nullable|numeric|min:0',
        ]);

        $item = MenuItem::findOrFail($id);
        $item->update([
            'cost_per_head' => $data['cost_per_head'],
            'price_adj' => $data['price_adj'] ?? 0,
        ]);

        return response()->json(['message' => 'Dish pricing updated successfully.', 'item' => $item->fresh()]);
    }

    public function createEventType(Request $request)
    {
        $data = $request->validate([
            'label' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:event_types,slug',
            'icon' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'package_category' => 'nullable|string|max:255',
            'applicable_setups' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'security_description' => 'nullable|string',
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['label']);
        $data['icon'] = $data['icon'] ?? 'sparkles';
        $data['package_category'] = $data['package_category'] ?? 'standard';
        $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups'] ?? []);

        if (EventType::where('slug', $data['slug'])->exists()) {
            return response()->json(['error' => 'An event type with this slug already exists.'], 422);
        }

        $eventType = EventType::create($data);

        return response()->json($eventType, 201);
    }

    public function updateEventType(Request $request, int $id)
    {
        $eventType = EventType::findOrFail($id);

        $data = $request->validate([
            'label' => 'sometimes|required|string|max:255',
            'slug' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('event_types', 'slug')->ignore($eventType->id)],
            'icon' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:2048',
            'package_category' => 'nullable|string|max:255',
            'applicable_setups' => 'nullable',
            'security_type' => 'nullable|string|max:255',
            'security_label' => 'nullable|string|max:255',
            'security_description' => 'nullable|string',
        ]);

        if (array_key_exists('slug', $data)) {
            Package::where('type', $eventType->slug)->update(['type' => $data['slug']]);
            Package::all()->each(function (Package $package) use ($eventType, $data) {
                $slugs = $package->event_type_slugs ?: [];
                if (!in_array($eventType->slug, $slugs, true)) {
                    return;
                }

                $package->event_type_slugs = array_values(array_unique(array_map(
                    fn ($slug) => $slug === $eventType->slug ? $data['slug'] : $slug,
                    $slugs
                )));
                $package->save();
            });
        }
        if (array_key_exists('applicable_setups', $data)) {
            $data['applicable_setups'] = $this->normalizeLines($data['applicable_setups']);
        }

        $eventType->update($data);

        return response()->json(['message' => 'Event type updated successfully.', 'event_type' => $eventType->fresh()]);
    }

    public function deleteEventType(int $id)
    {
        $eventType = EventType::findOrFail($id);

        Package::where('type', $eventType->slug)->update(['type' => 'other']);
        Package::all()->each(function (Package $package) use ($eventType) {
            $slugs = $package->event_type_slugs ?: [];
            if (!in_array($eventType->slug, $slugs, true)) {
                return;
            }

            $remaining = array_values(array_filter($slugs, fn ($slug) => $slug !== $eventType->slug));
            $package->event_type_slugs = $remaining ?: ['other'];
            $package->save();
        });
        $eventType->delete();

        return response()->json(['message' => 'Event type deleted successfully.']);
    }

    private function normalizeLines($value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value));
        }

        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $value))));
    }

    private function normalizeSlugs($value): array
    {
        if (is_array($value)) {
            return array_values(array_unique(array_filter(array_map('trim', $value))));
        }

        return array_values(array_unique(array_filter(array_map('trim', preg_split('/,|\r\n|\r|\n/', (string) $value)))));
    }

    private function normalizeMenuStructure($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }
}
