-- 03: Small additions the requested features need. Requires 01.

-- (a) "Mark as featured". Alters an existing table: one NULLABLE column, default false.
--     No existing function reads it.
alter table public.vehicles
  add column if not exists is_featured boolean default false;
create index if not exists vehicles_is_featured_idx on public.vehicles (is_featured) where is_featured;

-- (b) Contact form messages (new table).
create table if not exists public.contact_messages (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) between 3 and 254),
  phone      text check (phone is null or char_length(phone) <= 40),
  subject    text check (subject is null or char_length(subject) <= 200),
  message    text not null check (char_length(message) between 1 and 4000),
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;
drop policy if exists "nexdrive_public_insert_contact" on public.contact_messages;
create policy "nexdrive_public_insert_contact" on public.contact_messages
  for insert to anon, authenticated with check (handled = false);
drop policy if exists "nexdrive_admin_all_contact" on public.contact_messages;
create policy "nexdrive_admin_all_contact" on public.contact_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- (c) Admin: create a vehicle. vehicle_id (VEH-000000) and stock_number (NX-000000) have
--     no default, so the ID is minted and the row inserted in ONE transaction under a lock.
--     SECURITY INVOKER: the caller's RLS still applies, plus an explicit admin check.
drop function if exists public.admin_next_id(text);  -- from the first draft of this file, never applied
create or replace function public.admin_create_vehicle(p_vehicle jsonb)
returns public.vehicles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_num bigint;
  v_row public.vehicles;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nexdrive:vehicle-id', 0));
  select coalesce(max(substring(vehicle_id from 5)::bigint), 0) + 1 into v_num from public.vehicles;
  if v_num > 999999 then
    raise exception 'vehicle id range exhausted';
  end if;

  insert into public.vehicles
  select * from jsonb_populate_record(
    null::public.vehicles,
    jsonb_build_object('mileage', 0, 'test_drive_available', false, 'is_featured', false)
      || (p_vehicle - 'vehicle_id' - 'stock_number' - 'created_at' - 'updated_at')
      || jsonb_build_object(
           'vehicle_id',   'VEH-' || lpad(v_num::text, 6, '0'),
           'stock_number', 'NX-'  || lpad(v_num::text, 6, '0'),
           'created_at',   now(),
           'updated_at',   now()))
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_create_vehicle(jsonb) from public;
grant execute on function public.admin_create_vehicle(jsonb) to authenticated;

-- (d) Admin: create an appointment. Uses the SAME generator as create_test_drive_atomic
--     (MAX+1 under the 'nexdrive:appointment-id' advisory lock) and the same lead and slot
--     lock keys, so it serializes correctly against the voice agent and the website.
--     Staff may book outside a salesperson's shift, but never into an occupied active slot.
create or replace function public.admin_create_appointment(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id        text := p_request->>'lead_id';
  v_customer_id    text := p_request->>'customer_id';
  v_vehicle_id     text := p_request->>'vehicle_id';
  v_salesperson_id text := p_request->>'salesperson_id';
  v_type           text := coalesce(p_request->>'appointment_type', 'Test Drive');
  v_status         text := coalesce(p_request->>'status', 'Confirmed');
  v_created_by     text := coalesce(p_request->>'created_by', 'Customer Service');
  v_date           date;
  v_time           time;
  v_existing       public.appointments%rowtype;
  v_created        public.appointments%rowtype;
  v_appointment_id text;
  v_constraint     text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_lead_id is null or v_lead_id !~ '^LEAD-[0-9]{6}$'
     or v_customer_id is null or v_customer_id !~ '^CUST-[0-9]{6}$'
     or v_vehicle_id is null or v_vehicle_id !~ '^VEH-[0-9]{6}$'
     or v_salesperson_id is null or v_salesperson_id !~ '^SP-[0-9]{3}$' then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_REFERENCE', 'message', 'One or more booking IDs are invalid');
  end if;
  if v_created_by not in ('Salesperson', 'Customer Service') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_DATA', 'message', 'created_by must be Salesperson or Customer Service');
  end if;

  begin
    v_date := (p_request->>'appointment_date')::date;
    v_time := (p_request->>'appointment_time')::time;
  exception when invalid_datetime_format or datetime_field_overflow then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment date or time is invalid');
  end;
  if v_date is null or v_time is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment date and time are required');
  end if;
  if extract(minute from v_time)::integer not in (0, 30) or extract(second from v_time) <> 0 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment time must use a 30-minute increment');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nexdrive:appointment:lead:' || v_lead_id, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'nexdrive:appointment:slot:' || v_salesperson_id || ':' || v_date::text || ':' || v_time::text, 0));

  select * into v_existing from public.appointments where lead_id = v_lead_id limit 1;
  if found then
    return jsonb_build_object('success', false, 'error_code', 'EXISTING_APPOINTMENT_CONFLICT',
      'message', 'This lead already has an appointment', 'existing_appointment', to_jsonb(v_existing));
  end if;

  perform 1 from public.leads where lead_id = v_lead_id and customer_id = v_customer_id;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'LEAD_CUSTOMER_MISMATCH', 'message', 'Lead not found for this customer');
  end if;

  if v_status in ('Requested', 'Confirmed', 'Rescheduled') then
    perform 1 from public.appointments
     where salesperson_id = v_salesperson_id and appointment_date = v_date and appointment_time = v_time
       and status in ('Requested', 'Confirmed', 'Rescheduled')
     limit 1;
    if found then
      return jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_SLOT_UNAVAILABLE', 'message', 'That salesperson already has an appointment at this time');
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nexdrive:appointment-id', 0));
  select 'APT-' || lpad((coalesce(max(substring(appointment_id from 5)::integer), 0) + 1)::text, 6, '0')
    into v_appointment_id from public.appointments;

  begin
    insert into public.appointments (
      appointment_id, lead_id, customer_id, vehicle_id, salesperson_id,
      appointment_date, appointment_time, appointment_type, status,
      created_by, notes, created_at, updated_at
    ) values (
      v_appointment_id, v_lead_id, v_customer_id, v_vehicle_id, v_salesperson_id,
      v_date, v_time, v_type, v_status,
      v_created_by, coalesce(p_request->>'notes', ''), now(), now()
    ) returning * into v_created;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'appointments_active_salesperson_slot_uniq' then
        return jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_SLOT_UNAVAILABLE', 'message', 'That salesperson already has an appointment at this time');
      end if;
      return jsonb_build_object('success', false, 'error_code', 'EXISTING_APPOINTMENT_CONFLICT', 'message', 'This lead already has an appointment');
    when check_violation then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_DATA', 'message', 'Appointment type or status is not allowed');
    when foreign_key_violation then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_REFERENCE', 'message', 'Customer, vehicle or salesperson was not found');
  end;

  return jsonb_build_object('success', true, 'created', true, 'appointment', to_jsonb(v_created));
end;
$$;
revoke all on function public.admin_create_appointment(jsonb) from public;
grant execute on function public.admin_create_appointment(jsonb) to authenticated;
