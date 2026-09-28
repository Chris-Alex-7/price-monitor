-- Run once in the Supabase SQL Editor.
create table prices (
  date          date    not null,
  supermarket   text    not null,
  product       text    not null,
  price_paid    numeric(6, 2) not null,
  regular_price numeric(6, 2) not null,
  offer_text    text,
  offer_start   date,
  offer_end     date,
  source_url    text    not null,
  raw           jsonb   not null,
  -- One row per product per supermarket per day; re-running a day replaces its rows.
  primary key (date, supermarket, product)
);

-- Row level security: only what the policies below allow. The secret key bypasses this.
alter table prices enable row level security;

-- New tables are not exposed to the Data API automatically, so grant access explicitly.
-- The collector (secret key) writes; the web page (publishable key, role "anon") can only read.
grant select, insert, update on prices to service_role;
grant select on prices to anon;
create policy "Anyone can read prices" on prices for select to anon using (true);
