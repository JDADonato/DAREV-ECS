<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use Illuminate\Database\Eloquent\Model;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Phase 1: N+1 Query Eradication
        // Throws an exception when a lazy loading N+1 query happens in dev/testing.
        Model::preventLazyLoading(! $this->app->isProduction());
    }
}
