-- Run once in the Supabase SQL Editor.

-- Products we follow, with each supermarket's code typed in by hand (empty = not tracked there).
create table products (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  brand         text not null,
  ab_code       text unique,
  galaxias_code text unique,
  kritikos_code text unique
);

create table prices (
  date          date    not null,
  supermarket   text    not null,
  product_id    bigint  not null references products (id),
  price_paid    numeric(6, 2) not null,
  regular_price numeric(6, 2) not null,
  offer_text    text,
  offer_start   date,
  offer_end     date,
  source_url    text    not null,
  raw           jsonb   not null,
  -- One row per product per supermarket per day; re-running a day replaces its rows.
  primary key (date, supermarket, product_id)
);
-- Postgres does not index foreign keys by itself.
create index prices_product_id_idx on prices (product_id);

-- Competitor decisions. Nothing is granted delete, so decisions stay forever.
create table competitors (
  product_id    bigint not null references products (id),
  competitor_id bigint not null references products (id),
  status        text   not null check (status in ('approved', 'rejected')),
  decided_at    timestamptz not null default now(),
  primary key (product_id, competitor_id),
  check (product_id <> competitor_id)
);
create index competitors_competitor_id_idx on competitors (competitor_id);

-- Row level security: only what the policies below allow. The secret key bypasses this.
alter table products enable row level security;
alter table prices enable row level security;
alter table competitors enable row level security;

-- New tables are not exposed to the Data API automatically, so grant access explicitly.
-- The collector (secret key) reads products and writes prices; the web page (publishable key, role "anon") can only read.
grant select on products to service_role;
grant select, insert, update on prices to service_role;
grant select on products, prices, competitors to anon;
create policy "Anyone can read products" on products for select to anon using (true);
create policy "Anyone can read prices" on prices for select to anon using (true);
create policy "Anyone can read competitors" on competitors for select to anon using (true);
