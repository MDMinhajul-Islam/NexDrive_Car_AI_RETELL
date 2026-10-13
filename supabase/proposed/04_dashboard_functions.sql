-- 04: Dashboard aggregation, done in Postgres. Requires 01 and 02.
-- All functions are SECURITY INVOKER (RLS still applies) and also refuse non-admins.
-- "Bookings" = rows in public.appointments.
-- Timezone: every date boundary is America/Chicago. Range filters use the Chicago calendar
-- date of appointments.created_at (when the booking was made). Weekday/hour charts and
-- "upcoming" use appointment_date/appointment_time, which are already dealership local time.
-- Status values are the exact ones from the check constraints:
--   appointments: Requested, Confirmed, Completed, Cancelled, No Show, Rescheduled
--   vehicles:     Available, Reserved, Sold, Pending Sale, In Service, Arriving Soon,
--                 Demo Vehicle, No Test Drive
-- "In stock" = every status except Sold and Arriving Soon.

create or replace function public.dashboard_kpis(p_from date, p_to date)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v jsonb;
  m_start date := date_trunc('month', (now() at time zone 'America/Chicago'))::date;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_bookings',      count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to),
    'pending_bookings',    count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to and a.status = 'Requested'),
    'completed_bookings',  count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to and a.status = 'Completed'),
    'confirmed_bookings',  count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to and a.status = 'Confirmed'),
    'no_show_bookings',    count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to and a.status = 'No Show'),
    'cancelled_bookings',  count(*) filter (where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to and a.status = 'Cancelled'),
    'bookings_this_month', count(*) filter (where (a.created_at at time zone 'America/Chicago')::date >= m_start),
    'bookings_last_month', count(*) filter (where (a.created_at at time zone 'America/Chicago')::date >= (m_start - interval '1 month')::date and (a.created_at at time zone 'America/Chicago')::date < m_start)
  ) into v from public.appointments a;

  return v || (
    select jsonb_build_object(
      'cars_in_stock',   count(*) filter (where vehicle_status not in ('Sold', 'Arriving Soon')),
      'cars_available',  count(*) filter (where vehicle_status = 'Available'),
      'cars_sold',       count(*) filter (where vehicle_status = 'Sold'),
      'cars_total',      count(*),
      'inventory_value', coalesce(sum(sale_price) filter (where vehicle_status not in ('Sold', 'Arriving Soon')), 0)
    ) from public.vehicles);
end;
$$;

create or replace function public.dashboard_bookings_over_time(p_from date, p_to date)
returns table (day date, bookings bigint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select d::date, count(a.appointment_id)
    from generate_series(p_from, p_to, interval '1 day') d
    left join public.appointments a on (a.created_at at time zone 'America/Chicago')::date = d::date
    group by d order by d;
end;
$$;

create or replace function public.dashboard_bookings_by_status(p_from date, p_to date)
returns table (status text, bookings bigint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select a.status, count(*) from public.appointments a
    where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to
    group by a.status order by count(*) desc;
end;
$$;

create or replace function public.dashboard_top_vehicles(p_from date, p_to date, p_limit int default 8)
returns table (vehicle_id text, vehicle_name text, bookings bigint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select v.vehicle_id, (v.year || ' ' || v.make || ' ' || v.model)::text, count(*)
    from public.appointments a join public.vehicles v on v.vehicle_id = a.vehicle_id
    where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to
    group by v.vehicle_id, v.year, v.make, v.model
    order by count(*) desc, v.vehicle_id
    limit greatest(1, least(p_limit, 50));
end;
$$;

create or replace function public.dashboard_bookings_by_weekday(p_from date, p_to date)
returns table (weekday int, bookings bigint)   -- 0 = Sunday
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select g, count(a.appointment_id)
    from generate_series(0, 6) g
    left join public.appointments a
      on extract(dow from a.appointment_date::date)::int = g
     and (a.created_at at time zone 'America/Chicago')::date between p_from and p_to
    group by g order by g;
end;
$$;

create or replace function public.dashboard_bookings_by_hour(p_from date, p_to date)
returns table (hour int, bookings bigint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select extract(hour from a.appointment_time::time)::int, count(*)
    from public.appointments a
    where (a.created_at at time zone 'America/Chicago')::date between p_from and p_to
    group by 1 order by 1;
end;
$$;

create or replace function public.dashboard_inventory_breakdown(p_dimension text default 'make')
returns table (label text, vehicles bigint, total_value numeric)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select case when p_dimension = 'body_type' then v.body_type else v.make end,
           count(*), coalesce(sum(v.sale_price), 0)::numeric
    from public.vehicles v
    where v.vehicle_status not in ('Sold', 'Arriving Soon')
    group by 1 order by count(*) desc;
end;
$$;

-- Distinct filter values for the public inventory page, so the browser never loads all rows.
create or replace function public.inventory_facets()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'makes',         (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct make x from public.vehicles where vehicle_status <> 'Sold') s),
    'body_types',    (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct body_type x from public.vehicles) s),
    'fuel_types',    (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct fuel_type x from public.vehicles) s),
    'transmissions', (select coalesce(jsonb_agg(x order by x), '[]') from (select distinct transmission x from public.vehicles) s),
    'year_min',      (select min(year) from public.vehicles),
    'year_max',      (select max(year) from public.vehicles),
    'price_min',     (select min(sale_price) from public.vehicles),
    'price_max',     (select max(sale_price) from public.vehicles)
  );
$$;

revoke all on function
  public.dashboard_kpis(date, date),
  public.dashboard_bookings_over_time(date, date),
  public.dashboard_bookings_by_status(date, date),
  public.dashboard_top_vehicles(date, date, int),
  public.dashboard_bookings_by_weekday(date, date),
  public.dashboard_bookings_by_hour(date, date),
  public.dashboard_inventory_breakdown(text)
from public;
grant execute on function
  public.dashboard_kpis(date, date),
  public.dashboard_bookings_over_time(date, date),
  public.dashboard_bookings_by_status(date, date),
  public.dashboard_top_vehicles(date, date, int),
  public.dashboard_bookings_by_weekday(date, date),
  public.dashboard_bookings_by_hour(date, date),
  public.dashboard_inventory_breakdown(text)
to authenticated;
grant execute on function public.inventory_facets() to anon, authenticated;

-- Helpful indexes for the queries above (no-ops if equivalents exist).
create index if not exists appointments_created_at_idx on public.appointments (created_at);
create index if not exists appointments_date_idx on public.appointments (appointment_date);
create index if not exists appointments_status_idx on public.appointments (status);
