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

-- No public access. The collector uses the secret key, which bypasses this.
alter table prices enable row level security;

-- New tables are not exposed to the Data API automatically, so allow only the secret key (service_role).
grant select, insert, update on prices to service_role;
