create table if not exists snapshots (
  id bigserial primary key,
  fetched_at timestamptz not null default now(),
  provider text not null,
  rows_count int not null,
  payload jsonb not null,
  fetch_ms int not null,
  ok boolean not null
);
create index if not exists snapshots_fetched_at_idx on snapshots (fetched_at desc);
create index if not exists snapshots_provider_fetched_at_idx on snapshots (provider, fetched_at desc);

create table if not exists gpu_prices (
  fetched_at timestamptz not null,
  gpu_model text not null,
  provider text not null,
  tier text not null,
  median_price_per_gpu_hour_usd numeric not null,
  cheapest_price_per_gpu_hour_usd numeric not null,
  available_count int not null,
  primary key (fetched_at, gpu_model, provider, tier)
);
create index if not exists gpu_prices_model_idx on gpu_prices (gpu_model, fetched_at desc);
