-- StockPulse Ads & Notice Center
-- Run this in Supabase SQL Editor before publishing the updated app.
-- Admin access is limited to the approved email addresses below.
create extension if not exists pgcrypto;

create table if not exists public.app_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 90),
  description text not null default '' check (char_length(description) <= 220),
  image_url text,
  target_url text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.app_notices (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 300),
  target_url text,
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  display_order integer not null default 100,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create index if not exists app_ads_active_order_idx on public.app_ads (is_active, display_order);
create index if not exists app_notices_active_order_idx on public.app_notices (is_active, display_order);

alter table public.app_ads enable row level security;
alter table public.app_notices enable row level security;

drop policy if exists "Anyone can read active ads" on public.app_ads;
create policy "Anyone can read active ads" on public.app_ads
for select to authenticated
using (is_active = true and starts_at <= now() and (ends_at is null or ends_at >= now()));

drop policy if exists "StockPulse admins manage ads" on public.app_ads;
create policy "StockPulse admins manage ads" on public.app_ads
for all to authenticated
using ((auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'))
with check ((auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'));

drop policy if exists "Anyone can read active notices" on public.app_notices;
create policy "Anyone can read active notices" on public.app_notices
for select to authenticated
using (is_active = true and starts_at <= now() and (ends_at is null or ends_at >= now()));

drop policy if exists "StockPulse admins manage notices" on public.app_notices;
create policy "StockPulse admins manage notices" on public.app_notices
for all to authenticated
using ((auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'))
with check ((auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'));

-- Private bucket: only signed-in users can view active ad images via public URLs? 
-- This bucket is public for image delivery; writes remain admin-only.
insert into storage.buckets (id, name, public)
values ('stockpulse-ads', 'stockpulse-ads', true)
on conflict (id) do update set public = true;

drop policy if exists "StockPulse admins upload ad images" on storage.objects;
create policy "StockPulse admins upload ad images" on storage.objects
for insert to authenticated
with check (bucket_id = 'stockpulse-ads' and (auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'));

drop policy if exists "StockPulse admins update ad images" on storage.objects;
create policy "StockPulse admins update ad images" on storage.objects
for update to authenticated
using (bucket_id = 'stockpulse-ads' and (auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'))
with check (bucket_id = 'stockpulse-ads' and (auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'));

drop policy if exists "StockPulse admins delete ad images" on storage.objects;
create policy "StockPulse admins delete ad images" on storage.objects
for delete to authenticated
using (bucket_id = 'stockpulse-ads' and (auth.jwt() ->> 'email') in ('admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'));
