-- 07_fixes.sql
-- Applies on top of 01-06 as they are in the live database.
-- Uses ONLY: create or replace function / grant / revoke, plus read-only selects at the end.
-- No table changes. No policy changes. No existing Retell function is modified.
--
-- Contents
--   1. private.require_website_booking_key()        new   server-only secret check
--   2. public.resolve_or_create_customer_website()  new   customer step for the website
--   3. public.upsert_lead_website()                 new   lead step for the website
--   4. public.create_test_drive_website()           REPLACES the applied version
--   5. public.admin_create_appointment()            REPLACES the applied version
--   6. grants (re-enables create_test_drive_website for anon)
--   7. read-only verification
--   8. Vault secret (commented, run by hand)
--
-- ID generators (decision 1: sequences only, no MAX+1, no setval)
--   appointments  nextval('public.appointment_id_seq')   same as create_test_drive
--   customers     nextval('public.customer_id_seq')      same as resolve_or_create_customer
--   leads         nextval('public.lead_id_seq')          ASSUMED, SEE BELOW
--
-- !! LEAD ID GENERATOR IS UNVERIFIED !!
-- The body of create_or_update_lead was not in either inspect report, so I could not read
-- it. public.lead_id_seq is assumed by analogy with the other two live functions.
-- Run this read-only query BEFORE applying, and tell me the result:
--
--   select prosrc ilike '%lead_id_seq%'  as uses_lead_id_seq,
--          prosrc ~* 'max\s*\('          as uses_max_plus_one,
--          to_regclass('public.lead_id_seq') is not null as lead_id_seq_exists,
--          regexp_replace(prosrc, '\s+', ' ', 'g') as body
--   from pg_proc
--   where pronamespace = 'public'::regnamespace and proname = 'create_or_update_lead';
--
-- If it does not use lead_id_seq, change the two lines marked LEAD-ID-GENERATOR below.


-- ===========================================================================
-- 1. Website key check
--    Same pattern as private.require_retell_tool_key, with a SEPARATE secret.
--    Header:        x-nexdrive-website-key   (sent by the Next.js Server Action from
--                                             the server-only env var WEBSITE_BOOKING_KEY)
--    Vault secret:  website_booking_key
-- ===========================================================================
create or replace function private.require_website_booking_key()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers  jsonb;
  v_provided text;
  v_expected text;
begin
  v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_provided := v_headers ->> 'x-nexdrive-website-key';

  select decrypted_secret into v_expected
  from vault.decrypted_secrets
  where name = 'website_booking_key'
  order by created_at desc
  limit 1;

  if v_expected is null or length(v_expected) < 32 then
    raise exception using errcode = '42501', message = 'Website authentication unavailable';
  end if;

  if v_provided is null
     or sha256(convert_to(v_provided, 'UTF8')) <> sha256(convert_to(v_expected, 'UTF8')) then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;
end;
$$;


-- ===========================================================================
-- 2. resolve_or_create_customer_website
--    Same logic as resolve_or_create_customer: phone normalization, advisory lock on
--    the normalized phone, EMAIL_IN_USE rule, nextval('public.customer_id_seq'), state 'TX'.
--    Differences: website key instead of Retell key; new customers get lead_source
--    'Website'; the response returns only customer_id and created.
-- ===========================================================================
create or replace function public.resolve_or_create_customer_website(
  p_first_name text,
  p_last_name  text,
  p_phone      text,
  p_email      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    v_phone text;
    v_email text;
    v_last_name text;
    v_customer public.customers%rowtype;
    v_email_owner text;
    v_next_number bigint;
    v_customer_id text;
BEGIN
    PERFORM private.require_website_booking_key();

    IF p_first_name IS NULL OR trim(p_first_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_FIRST_NAME', 'message', 'Please provide the customer first name.');
    END IF;

    v_phone := public.normalize_customer_phone(p_phone);
    IF v_phone IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PHONE', 'message', 'A valid US phone number is required.');
    END IF;

    v_last_name := COALESCE(NULLIF(trim(p_last_name), ''), '');
    v_email := CASE WHEN p_email IS NULL OR trim(p_email) = '' THEN NULL ELSE lower(trim(p_email)) END;

    IF v_email IS NOT NULL
       AND v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_EMAIL', 'message', 'Please provide a valid email address.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_phone, 0));

    SELECT * INTO v_customer FROM public.customers WHERE synthetic_phone = v_phone LIMIT 1;

    IF FOUND THEN
        IF v_email IS NOT NULL THEN
            SELECT customer_id INTO v_email_owner FROM public.customers
            WHERE lower(synthetic_email) = v_email AND customer_id <> v_customer.customer_id
            LIMIT 1;
            IF v_email_owner IS NOT NULL THEN
                RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_IN_USE', 'message', 'That email is already associated with another customer.');
            END IF;
        END IF;

        UPDATE public.customers
        SET last_name = CASE WHEN trim(last_name) = '' AND v_last_name <> '' THEN v_last_name ELSE last_name END,
            synthetic_email = COALESCE(synthetic_email, v_email),
            updated_at = now()
        WHERE customer_id = v_customer.customer_id
        RETURNING * INTO v_customer;

        RETURN jsonb_build_object('success', true, 'customer_id', v_customer.customer_id, 'created', false);
    END IF;

    IF v_email IS NOT NULL THEN
        SELECT customer_id INTO v_email_owner FROM public.customers
        WHERE lower(synthetic_email) = v_email LIMIT 1;
        IF v_email_owner IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_IN_USE', 'message', 'That email is already associated with another customer.');
        END IF;
    END IF;

    v_next_number := nextval('public.customer_id_seq');
    IF v_next_number > 999999 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'CUSTOMER_ID_LIMIT', 'message', 'Customer record could not be created.');
    END IF;
    v_customer_id := 'CUST-' || lpad(v_next_number::text, 6, '0');

    INSERT INTO public.customers (
        customer_id, first_name, last_name, synthetic_phone, synthetic_email,
        state, lead_source, created_at, updated_at
    ) VALUES (
        v_customer_id, left(trim(p_first_name), 60), left(v_last_name, 60), v_phone, v_email,
        'TX', 'Website', now(), now()
    ) RETURNING * INTO v_customer;

    RETURN jsonb_build_object('success', true, 'customer_id', v_customer.customer_id, 'created', true);

EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE;
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'CUSTOMER_CONFLICT', 'message', 'That customer information is already associated with another record.');
    WHEN check_violation THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CUSTOMER_DATA', 'message', 'The customer information is not in a valid format.');
    WHEN OTHERS THEN
        RAISE LOG 'resolve_or_create_customer_website failed. SQLSTATE=% MESSAGE=%', SQLSTATE, SQLERRM;
        RETURN jsonb_build_object('success', false, 'error_code', 'CUSTOMER_OPERATION_FAILED', 'message', 'Customer information could not be saved right now.');
END;
$function$;


-- ===========================================================================
-- 3. upsert_lead_website
--    Repeat-customer rule (decision 2), applied to the customer's MOST RECENT open
--    lead (lead_status not Won/Lost, newest updated_at):
--      no open lead                               -> create a new lead
--      open lead has no appointment               -> reuse it
--      its appointment is Requested / Confirmed /
--        Rescheduled                              -> UPCOMING_APPOINTMENT_EXISTS
--                                                    (returns that appointment's date/time)
--      its appointment is Completed / Cancelled /
--        No Show                                  -> create a new lead
--    A reused lead only gets vehicle_interest, next_followup_date and updated_at
--    touched (create_test_drive rejects a lead whose vehicle_interest differs).
--    A new lead is source 'Website', status 'New', score 60 / 'Warm' (decision 3).
--    Serialized per customer with 'nexdrive:lead:<customer_id>'.
-- ===========================================================================
create or replace function public.upsert_lead_website(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    v_customer_id TEXT := p_request->>'customer_id';
    v_vehicle_id TEXT := p_request->>'vehicle_interest';
    v_salesperson_id TEXT := p_request->>'assigned_salesperson';
    v_lead public.leads%ROWTYPE;
    v_appt public.appointments%ROWTYPE;
    v_next_number BIGINT;
    v_lead_id TEXT;
BEGIN
    PERFORM private.require_website_booking_key();

    IF v_customer_id IS NULL OR v_customer_id !~ '^CUST-[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CUSTOMER_ID', 'message', 'Customer ID is invalid');
    END IF;
    IF v_vehicle_id IS NULL OR v_vehicle_id !~ '^VEH-[0-9]{6}$' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_VEHICLE_ID', 'message', 'Vehicle ID is invalid');
    END IF;
    IF v_salesperson_id IS NOT NULL AND v_salesperson_id !~ '^SP-[0-9]{3}$' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_SALESPERSON_ID', 'message', 'Salesperson ID is invalid');
    END IF;

    PERFORM 1 FROM public.customers WHERE customer_id = v_customer_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'CUSTOMER_NOT_FOUND', 'message', 'Customer not found');
    END IF;
    PERFORM 1 FROM public.vehicles WHERE vehicle_id = v_vehicle_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'VEHICLE_NOT_FOUND', 'message', 'Vehicle not found');
    END IF;
    IF v_salesperson_id IS NOT NULL THEN
        PERFORM 1 FROM public.salespeople
        WHERE salesperson_id = v_salesperson_id AND active = true FOR SHARE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'SALESPERSON_NOT_FOUND', 'message', 'Salesperson is unavailable');
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('nexdrive:lead:' || v_customer_id, 0));

    SELECT * INTO v_lead FROM public.leads
    WHERE customer_id = v_customer_id AND lead_status NOT IN ('Won', 'Lost')
    ORDER BY updated_at DESC
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
        -- appointments.lead_id is UNIQUE, so there is at most one row.
        SELECT * INTO v_appt FROM public.appointments WHERE lead_id = v_lead.lead_id LIMIT 1;

        IF NOT FOUND THEN
            UPDATE public.leads
            SET vehicle_interest = v_vehicle_id,
                next_followup_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE lead_id = v_lead.lead_id;
            RETURN jsonb_build_object('success', true, 'created', false, 'lead_id', v_lead.lead_id);
        END IF;

        IF v_appt.status IN ('Requested', 'Confirmed', 'Rescheduled') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'UPCOMING_APPOINTMENT_EXISTS',
                'message', 'You already have an upcoming appointment',
                'existing_appointment', jsonb_build_object(
                    'appointment_id', v_appt.appointment_id,
                    'appointment_date', v_appt.appointment_date,
                    'appointment_time', v_appt.appointment_time,
                    'status', v_appt.status)
            );
        END IF;
        -- Completed / Cancelled / No Show: fall through and open a new lead.
    END IF;

    v_next_number := nextval('public.lead_id_seq');            -- LEAD-ID-GENERATOR (1 of 2)
    IF v_next_number > 999999 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'LEAD_ID_LIMIT', 'message', 'The lead could not be saved.');
    END IF;
    v_lead_id := 'LEAD-' || lpad(v_next_number::text, 6, '0');

    INSERT INTO public.leads (
        lead_id, customer_id, source, created_at, lead_status,
        vehicle_interest, lead_score, lead_temperature,
        assigned_salesperson, next_followup_date, notes, updated_at
    ) VALUES (
        v_lead_id, v_customer_id, 'Website', NOW(), 'New',
        v_vehicle_id, 60, 'Warm',
        v_salesperson_id, CURRENT_DATE, '', NOW()
    );

    RETURN jsonb_build_object('success', true, 'created', true, 'lead_id', v_lead_id);

EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE;
    WHEN unique_violation OR check_violation OR foreign_key_violation THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'LEAD_OPERATION_FAILED', 'message', 'The lead could not be saved.');
    WHEN OTHERS THEN
        RAISE LOG 'upsert_lead_website failed. SQLSTATE=% MESSAGE=%', SQLSTATE, SQLERRM;
        RETURN jsonb_build_object('success', false, 'error_code', 'LEAD_OPERATION_FAILED', 'message', 'The lead could not be saved.');
END;
$function$;


-- ===========================================================================
-- 4. create_test_drive_website   (replaces the applied version; same signature)
--    Now follows create_test_drive, the LIVE voice function, statement for statement:
--      same required-input checks and error codes (MISSING_*, APPOINTMENT_IN_PAST,
--        INVALID_APPOINTMENT_TIME, LEAD_*, CUSTOMER_NOT_FOUND, VEHICLE_UNAVAILABLE,
--        TEST_DRIVE_NOT_AVAILABLE, SALESPERSON_*, OUTSIDE_SALESPERSON_SHIFT,
--        LEAD_ALREADY_HAS_BOOKING, SLOT_UNAVAILABLE, VEHICLE_SLOT_UNAVAILABLE,
--        APPOINTMENT_ID_LIMIT, INVALID_BOOKING_REFERENCE, BOOKING_CONFLICT,
--        INVALID_BOOKING_DATA, BOOKING_OPERATION_FAILED)
--      same advisory lock keys: 'lead:<lead>', 'salesperson-slot:<sp>:<date>:<time>',
--        'vehicle-slot:<vehicle>:<date>:<time>'
--      same ID generator: nextval('public.appointment_id_seq')
--      same lead update afterwards and same response shape (booking_id, created, status, ...)
--    Differences:
--      private.require_website_booking_key() instead of the Retell key
--      created_by 'Voice Agent' -> 'Website'      (status is 'Requested' in both)
--      arguments arrive in one jsonb (signature kept from the applied version);
--        an unparsable date or time returns INVALID_APPOINTMENT_TIME
--      notes capped at 2000 characters
-- ===========================================================================
create or replace function public.create_test_drive_website(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    p_lead_id text := p_request->>'lead_id';
    p_customer_id text := p_request->>'customer_id';
    p_vehicle_id text := p_request->>'vehicle_id';
    p_salesperson_id text := p_request->>'salesperson_id';
    p_notes text := p_request->>'notes';
    p_appointment_date date;
    p_appointment_time time without time zone;

    v_lead public.leads%rowtype;
    v_vehicle public.vehicles%rowtype;
    v_salesperson public.salespeople%rowtype;
    v_existing public.appointments%rowtype;

    v_appointment_id text;
    v_next_number bigint;
    v_booking_datetime timestamptz;
    v_day_full text;
    v_day_short text;
begin
    -- AUTHENTICATION
    perform private.require_website_booking_key();

    -- REQUIRED INPUTS
    if p_lead_id is null or trim(p_lead_id) = '' then
        return jsonb_build_object('success', false, 'error_code', 'MISSING_LEAD_ID', 'message', 'A verified lead is required.');
    end if;
    if p_customer_id is null or trim(p_customer_id) = '' then
        return jsonb_build_object('success', false, 'error_code', 'MISSING_CUSTOMER_ID', 'message', 'A verified customer is required.');
    end if;
    if p_vehicle_id is null or trim(p_vehicle_id) = '' then
        return jsonb_build_object('success', false, 'error_code', 'MISSING_VEHICLE_ID', 'message', 'A verified vehicle is required.');
    end if;
    if p_salesperson_id is null or trim(p_salesperson_id) = '' then
        return jsonb_build_object('success', false, 'error_code', 'MISSING_SALESPERSON_ID', 'message', 'A verified salesperson is required.');
    end if;

    begin
        p_appointment_date := (p_request->>'appointment_date')::date;
        p_appointment_time := (p_request->>'appointment_time')::time;
    exception when others then
        return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'The selected appointment time is not a valid test-drive slot.');
    end;
    if p_appointment_date is null or p_appointment_time is null then
        return jsonb_build_object('success', false, 'error_code', 'MISSING_APPOINTMENT_TIME', 'message', 'A verified appointment date and time are required.');
    end if;

    -- DATE / TIME VALIDATION (Texas dealership time)
    v_booking_datetime := (p_appointment_date + p_appointment_time) at time zone 'America/Chicago';
    if v_booking_datetime <= now() then
        return jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_IN_PAST', 'message', 'The selected appointment time is no longer available.');
    end if;

    -- Only standard 30-minute slot boundaries.
    if extract(second from p_appointment_time) <> 0
       or extract(minute from p_appointment_time)::integer not in (0, 30) then
        return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'The selected appointment time is not a valid test-drive slot.');
    end if;

    -- SERIALIZE: lead, salesperson slot, vehicle slot (same keys as create_test_drive)
    perform pg_advisory_xact_lock(hashtextextended('lead:' || trim(p_lead_id), 0));
    perform pg_advisory_xact_lock(hashtextextended(
        'salesperson-slot:' || trim(p_salesperson_id) || ':' || p_appointment_date::text || ':' || p_appointment_time::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(
        'vehicle-slot:' || trim(p_vehicle_id) || ':' || p_appointment_date::text || ':' || p_appointment_time::text, 0));

    -- LEAD VALIDATION
    select * into v_lead from public.leads where lead_id = trim(p_lead_id) limit 1;
    if not found then
        return jsonb_build_object('success', false, 'error_code', 'LEAD_NOT_FOUND', 'message', 'The lead record could not be verified.');
    end if;
    if v_lead.customer_id <> trim(p_customer_id) then
        return jsonb_build_object('success', false, 'error_code', 'LEAD_CUSTOMER_MISMATCH', 'message', 'The lead does not belong to the selected customer.');
    end if;
    if v_lead.lead_status in ('Won', 'Lost') then
        return jsonb_build_object('success', false, 'error_code', 'LEAD_NOT_ACTIVE', 'message', 'This lead is no longer active for test-drive booking.');
    end if;
    if v_lead.vehicle_interest is not null and v_lead.vehicle_interest <> trim(p_vehicle_id) then
        return jsonb_build_object('success', false, 'error_code', 'LEAD_VEHICLE_MISMATCH', 'message', 'The selected vehicle does not match the current lead.');
    end if;

    -- CUSTOMER VALIDATION
    if not exists (select 1 from public.customers where customer_id = trim(p_customer_id)) then
        return jsonb_build_object('success', false, 'error_code', 'CUSTOMER_NOT_FOUND', 'message', 'The customer record could not be verified.');
    end if;

    -- VEHICLE VALIDATION
    select * into v_vehicle from public.vehicles where vehicle_id = trim(p_vehicle_id) limit 1;
    if not found then
        return jsonb_build_object('success', false, 'error_code', 'VEHICLE_NOT_FOUND', 'message', 'The selected vehicle could not be verified.');
    end if;
    if v_vehicle.vehicle_status <> 'Available' then
        return jsonb_build_object('success', false, 'error_code', 'VEHICLE_UNAVAILABLE', 'message', 'The selected vehicle is no longer available.');
    end if;
    if v_vehicle.test_drive_available is not true then
        return jsonb_build_object('success', false, 'error_code', 'TEST_DRIVE_NOT_AVAILABLE', 'message', 'The selected vehicle is not currently available for a test drive.');
    end if;

    -- SALESPERSON VALIDATION
    select * into v_salesperson from public.salespeople where salesperson_id = trim(p_salesperson_id) limit 1;
    if not found then
        return jsonb_build_object('success', false, 'error_code', 'SALESPERSON_NOT_FOUND', 'message', 'The selected salesperson could not be verified.');
    end if;
    if v_salesperson.active is not true then
        return jsonb_build_object('success', false, 'error_code', 'SALESPERSON_INACTIVE', 'message', 'The selected salesperson is not currently available.');
    end if;

    -- WORKING DAY VALIDATION (accepts Monday or Mon)
    v_day_full := lower(trim(to_char(p_appointment_date, 'FMDay')));
    v_day_short := lower(trim(to_char(p_appointment_date, 'Dy')));
    if not exists (
        select 1 from unnest(v_salesperson.working_days) as working_day
        where lower(trim(working_day)) in (v_day_full, v_day_short)
    ) then
        return jsonb_build_object('success', false, 'error_code', 'SALESPERSON_NOT_WORKING', 'message', 'The selected salesperson is not scheduled to work that day.');
    end if;

    -- SHIFT VALIDATION (the 30-minute appointment must fit fully inside the shift)
    if p_appointment_time < v_salesperson.shift_start
       or p_appointment_time + interval '30 minutes' > v_salesperson.shift_end then
        return jsonb_build_object('success', false, 'error_code', 'OUTSIDE_SALESPERSON_SHIFT', 'message', 'The selected time is outside the salesperson schedule.');
    end if;

    -- IDEMPOTENCY / EXISTING APPOINTMENT FOR LEAD (appointments.lead_id is UNIQUE)
    select * into v_existing from public.appointments where lead_id = trim(p_lead_id) limit 1;
    if found then
        if v_existing.customer_id = trim(p_customer_id)
           and v_existing.vehicle_id = trim(p_vehicle_id)
           and v_existing.salesperson_id = trim(p_salesperson_id)
           and v_existing.appointment_date = p_appointment_date
           and v_existing.appointment_time = p_appointment_time then
            return jsonb_build_object(
                'success', true,
                'booking_id', v_existing.appointment_id,
                'created', false,
                'status', v_existing.status,
                'appointment_date', v_existing.appointment_date,
                'appointment_time', v_existing.appointment_time,
                'message', 'Existing test-drive booking returned.');
        end if;
        return jsonb_build_object('success', false, 'error_code', 'LEAD_ALREADY_HAS_BOOKING', 'message', 'This lead already has a different booking.');
    end if;

    -- SALESPERSON SLOT CONFLICT
    if exists (
        select 1 from public.appointments
        where salesperson_id = trim(p_salesperson_id)
          and appointment_date = p_appointment_date
          and appointment_time = p_appointment_time
          and status in ('Requested', 'Confirmed', 'Rescheduled')
    ) then
        return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE', 'message', 'That test-drive time is no longer available.');
    end if;

    -- VEHICLE SLOT CONFLICT
    if exists (
        select 1 from public.appointments
        where vehicle_id = trim(p_vehicle_id)
          and appointment_date = p_appointment_date
          and appointment_time = p_appointment_time
          and status in ('Requested', 'Confirmed', 'Rescheduled')
    ) then
        return jsonb_build_object('success', false, 'error_code', 'VEHICLE_SLOT_UNAVAILABLE', 'message', 'That vehicle is already scheduled for that time.');
    end if;

    -- GENERATE APPOINTMENT ID (same sequence as create_test_drive)
    v_next_number := nextval('public.appointment_id_seq');
    if v_next_number > 999999 then
        return jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_ID_LIMIT', 'message', 'The booking could not be created.');
    end if;
    v_appointment_id := 'APT-' || lpad(v_next_number::text, 6, '0');

    -- CREATE BOOKING
    insert into public.appointments (
        appointment_id, lead_id, customer_id, vehicle_id, salesperson_id,
        appointment_date, appointment_time, appointment_type, status, created_by,
        notes, created_at, updated_at
    ) values (
        v_appointment_id, trim(p_lead_id), trim(p_customer_id), trim(p_vehicle_id), trim(p_salesperson_id),
        p_appointment_date, p_appointment_time, 'Test Drive', 'Requested', 'Website',
        left(coalesce(nullif(trim(p_notes), ''), ''), 2000), now(), now()
    )
    returning * into v_existing;

    -- UPDATE LEAD AFTER SUCCESSFUL BOOKING
    update public.leads
    set lead_status = 'Test Drive',
        vehicle_interest = trim(p_vehicle_id),
        assigned_salesperson = trim(p_salesperson_id),
        updated_at = now()
    where lead_id = trim(p_lead_id);

    return jsonb_build_object(
        'success', true,
        'booking_id', v_existing.appointment_id,
        'created', true,
        'status', v_existing.status,
        'appointment_date', v_existing.appointment_date,
        'appointment_time', v_existing.appointment_time,
        'message', 'Test-drive booking created.');

exception
    when insufficient_privilege then
        raise;
    when foreign_key_violation then
        return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_REFERENCE', 'message', 'One of the booking records could not be verified.');
    when unique_violation then
        return jsonb_build_object('success', false, 'error_code', 'BOOKING_CONFLICT', 'message', 'That booking could not be created because the slot or lead is already in use.');
    when check_violation then
        return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_DATA', 'message', 'The booking information is not valid.');
    when others then
        raise log 'create_test_drive_website failed. SQLSTATE=% MESSAGE=%', SQLSTATE, SQLERRM;
        return jsonb_build_object('success', false, 'error_code', 'BOOKING_OPERATION_FAILED', 'message', 'The test-drive booking could not be completed right now.');
end;
$function$;


-- ===========================================================================
-- 5. admin_create_appointment   (replaces the applied version; same signature)
--    Changes from the applied version:
--      ID from nextval('public.appointment_id_seq'), not MAX+1
--      lock keys are the LIVE ones from create_test_drive ('lead:', 'salesperson-slot:',
--        'vehicle-slot:'), so it serializes against voice and website bookings
--      vehicle slot conflict check added
--      lead_id is optional: when omitted, the same repeat-customer rule as the website
--        decides between reusing the open lead, refusing, or opening a new lead
--      a Test Drive appointment updates the lead the way create_test_drive does
--    Still SECURITY INVOKER (RLS applies) with an explicit admin check, and staff may
--    still book outside a shift or for a vehicle in any status.
--    request keys: customer_id, vehicle_id, salesperson_id, appointment_date,
--      appointment_time, [lead_id], [appointment_type], [status], [created_by], [notes],
--      [lead_source]
-- ===========================================================================
create or replace function public.admin_create_appointment(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id        text := nullif(trim(p_request->>'lead_id'), '');
  v_customer_id    text := p_request->>'customer_id';
  v_vehicle_id     text := p_request->>'vehicle_id';
  v_salesperson_id text := p_request->>'salesperson_id';
  v_type           text := coalesce(p_request->>'appointment_type', 'Test Drive');
  v_status         text := coalesce(p_request->>'status', 'Confirmed');
  v_created_by     text := coalesce(p_request->>'created_by', 'Customer Service');
  v_date           date;
  v_time           time;
  v_lead           public.leads%rowtype;
  v_existing       public.appointments%rowtype;
  v_created        public.appointments%rowtype;
  v_next_number    bigint;
  v_appointment_id text;
  v_constraint     text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if (v_lead_id is not null and v_lead_id !~ '^LEAD-[0-9]{6}$')
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
  exception when others then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment date or time is invalid');
  end;
  if v_date is null or v_time is null then
    return jsonb_build_object('success', false, 'error_code', 'MISSING_APPOINTMENT_TIME', 'message', 'Appointment date and time are required');
  end if;
  if extract(second from v_time) <> 0 or extract(minute from v_time)::integer not in (0, 30) then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment time must use a 30-minute increment');
  end if;

  perform 1 from public.customers where customer_id = v_customer_id;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'CUSTOMER_NOT_FOUND', 'message', 'Customer not found');
  end if;

  -- Resolve the lead when the caller did not name one (same rule as upsert_lead_website).
  perform pg_advisory_xact_lock(hashtextextended('nexdrive:lead:' || v_customer_id, 0));
  if v_lead_id is null then
    select * into v_lead from public.leads
     where customer_id = v_customer_id and lead_status not in ('Won', 'Lost')
     order by updated_at desc
     limit 1;

    if found then
      select * into v_existing from public.appointments where lead_id = v_lead.lead_id limit 1;
      if not found then
        v_lead_id := v_lead.lead_id;
      elsif v_existing.status in ('Requested', 'Confirmed', 'Rescheduled') then
        return jsonb_build_object(
          'success', false,
          'error_code', 'UPCOMING_APPOINTMENT_EXISTS',
          'message', 'This customer already has an upcoming appointment',
          'existing_appointment', jsonb_build_object(
            'appointment_id', v_existing.appointment_id,
            'appointment_date', v_existing.appointment_date,
            'appointment_time', v_existing.appointment_time,
            'status', v_existing.status));
      end if;
      -- Completed / Cancelled / No Show: v_lead_id stays null, a new lead is opened below.
    end if;

    if v_lead_id is null then
      v_next_number := nextval('public.lead_id_seq');          -- LEAD-ID-GENERATOR (2 of 2)
      if v_next_number > 999999 then
        return jsonb_build_object('success', false, 'error_code', 'LEAD_ID_LIMIT', 'message', 'The lead could not be created');
      end if;
      v_lead_id := 'LEAD-' || lpad(v_next_number::text, 6, '0');
      insert into public.leads (
        lead_id, customer_id, source, created_at, lead_status,
        vehicle_interest, lead_score, lead_temperature,
        assigned_salesperson, next_followup_date, notes, updated_at
      ) values (
        v_lead_id, v_customer_id, coalesce(p_request->>'lead_source', 'Walk-In'), now(), 'New',
        v_vehicle_id, 60, 'Warm',
        v_salesperson_id, current_date, '', now()
      );
    end if;
  end if;

  -- Same advisory lock keys as create_test_drive.
  perform pg_advisory_xact_lock(hashtextextended('lead:' || v_lead_id, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'salesperson-slot:' || v_salesperson_id || ':' || v_date::text || ':' || v_time::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'vehicle-slot:' || v_vehicle_id || ':' || v_date::text || ':' || v_time::text, 0));

  perform 1 from public.leads where lead_id = v_lead_id and customer_id = v_customer_id;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'LEAD_CUSTOMER_MISMATCH', 'message', 'Lead not found for this customer');
  end if;

  select * into v_existing from public.appointments where lead_id = v_lead_id limit 1;
  if found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'LEAD_ALREADY_HAS_BOOKING',
      'message', 'This lead already has an appointment',
      'existing_appointment', jsonb_build_object(
        'appointment_id', v_existing.appointment_id,
        'appointment_date', v_existing.appointment_date,
        'appointment_time', v_existing.appointment_time,
        'status', v_existing.status));
  end if;

  if v_status in ('Requested', 'Confirmed', 'Rescheduled') then
    if exists (
      select 1 from public.appointments
       where salesperson_id = v_salesperson_id and appointment_date = v_date and appointment_time = v_time
         and status in ('Requested', 'Confirmed', 'Rescheduled')
    ) then
      return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE', 'message', 'That salesperson already has an appointment at this time');
    end if;
    if exists (
      select 1 from public.appointments
       where vehicle_id = v_vehicle_id and appointment_date = v_date and appointment_time = v_time
         and status in ('Requested', 'Confirmed', 'Rescheduled')
    ) then
      return jsonb_build_object('success', false, 'error_code', 'VEHICLE_SLOT_UNAVAILABLE', 'message', 'That vehicle is already scheduled for this time');
    end if;
  end if;

  v_next_number := nextval('public.appointment_id_seq');
  if v_next_number > 999999 then
    return jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_ID_LIMIT', 'message', 'The booking could not be created');
  end if;
  v_appointment_id := 'APT-' || lpad(v_next_number::text, 6, '0');

  begin
    insert into public.appointments (
      appointment_id, lead_id, customer_id, vehicle_id, salesperson_id,
      appointment_date, appointment_time, appointment_type, status,
      created_by, notes, created_at, updated_at
    ) values (
      v_appointment_id, v_lead_id, v_customer_id, v_vehicle_id, v_salesperson_id,
      v_date, v_time, v_type, v_status,
      v_created_by, left(coalesce(p_request->>'notes', ''), 4000), now(), now()
    ) returning * into v_created;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'appointments_active_salesperson_slot_uniq' then
        return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE', 'message', 'That salesperson already has an appointment at this time');
      end if;
      return jsonb_build_object('success', false, 'error_code', 'BOOKING_CONFLICT', 'message', 'The slot or lead is already in use');
    when check_violation then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_DATA', 'message', 'Appointment type or status is not allowed');
    when foreign_key_violation then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_REFERENCE', 'message', 'Customer, vehicle or salesperson was not found');
  end;

  if v_type = 'Test Drive' then
    update public.leads
       set lead_status = 'Test Drive',
           vehicle_interest = v_vehicle_id,
           assigned_salesperson = v_salesperson_id,
           updated_at = now()
     where lead_id = v_lead_id and lead_status not in ('Won', 'Lost');
  end if;

  return jsonb_build_object('success', true, 'created', true, 'appointment', to_jsonb(v_created));
end;
$$;


-- ===========================================================================
-- 6. Grants
--    Website functions: anon ONLY (the Server Action calls with the publishable key and
--    no user session, plus the website key header). This re-enables
--    create_test_drive_website, which is now protected by the key check.
--    Admin function: authenticated only (and it checks is_admin() itself).
-- ===========================================================================
revoke all on function private.require_website_booking_key() from public, anon, authenticated;

revoke all on function public.resolve_or_create_customer_website(text, text, text, text) from public, anon, authenticated;
revoke all on function public.upsert_lead_website(jsonb) from public, anon, authenticated;
revoke all on function public.create_test_drive_website(jsonb) from public, anon, authenticated;

grant execute on function public.resolve_or_create_customer_website(text, text, text, text) to anon;
grant execute on function public.upsert_lead_website(jsonb) to anon;
grant execute on function public.create_test_drive_website(jsonb) to anon;

revoke all on function public.admin_create_appointment(jsonb) from public, anon;
grant execute on function public.admin_create_appointment(jsonb) to authenticated;


-- ===========================================================================
-- 7. Read-only verification. Changes nothing. Paste the result back.
--    Expect: every sequence next_value > table_max; website functions anon=true and
--    authenticated=false; admin functions anon=false and authenticated=true;
--    require_website_booking_key false/false; vault_secret_present true.
-- ===========================================================================
select jsonb_pretty(jsonb_build_object(
  'sequences', (
    select jsonb_object_agg(q.sequencename, jsonb_build_object(
             'exists', true,
             'last_value', q.last_value,
             'next_value', coalesce(q.last_value, q.start_value - q.increment_by) + q.increment_by,
             'table_max', q.table_max,
             'safe', coalesce(q.last_value, q.start_value - q.increment_by) + q.increment_by > coalesce(q.table_max, 0)))
    from (
      select s.sequencename, s.last_value, s.start_value, s.increment_by,
             case s.sequencename
               when 'appointment_id_seq' then (select max(substring(appointment_id from 5)::bigint) from public.appointments)
               when 'customer_id_seq'    then (select max(substring(customer_id from 6)::bigint) from public.customers)
               when 'lead_id_seq'        then (select max(substring(lead_id from 6)::bigint) from public.leads)
             end as table_max
      from pg_sequences s
      where s.schemaname = 'public'
        and s.sequencename in ('appointment_id_seq', 'customer_id_seq', 'lead_id_seq')
    ) q),
  'lead_id_seq_exists', to_regclass('public.lead_id_seq') is not null,
  'create_or_update_lead_generator', (
    select jsonb_build_object(
             'uses_lead_id_seq', p.prosrc ilike '%lead_id_seq%',
             'uses_max_plus_one', p.prosrc ~* 'max\s*\(')
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'create_or_update_lead'
    limit 1),
  'execute_rights', (
    select jsonb_agg(jsonb_build_object(
             'function', n.nspname || '.' || p.proname,
             'security_definer', p.prosecdef,
             'anon', has_function_privilege('anon', p.oid, 'execute'),
             'authenticated', has_function_privilege('authenticated', p.oid, 'execute'))
           order by n.nspname, p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
             'resolve_or_create_customer_website', 'upsert_lead_website', 'create_test_drive_website',
             'admin_create_appointment', 'admin_create_vehicle', 'is_admin',
             'dashboard_kpis', 'dashboard_bookings_over_time', 'dashboard_bookings_by_status',
             'dashboard_top_vehicles', 'dashboard_bookings_by_weekday', 'dashboard_bookings_by_hour',
             'dashboard_inventory_breakdown', 'inventory_facets'))
       or (n.nspname = 'private' and p.proname = 'require_website_booking_key')),
  'vault_secret_present', exists (select 1 from vault.secrets where name = 'website_booking_key')
)) as nexdrive_07_verification;


-- ===========================================================================
-- 8. Vault secret. NOT part of the script: run by hand, once, with the real value.
--    The value must equal WEBSITE_BOOKING_KEY in the app's environment
--    (at least 32 characters; generate with: openssl rand -hex 32).
--    Until this exists, all three website functions deny every call.
-- ===========================================================================
-- select vault.create_secret(
--   '<PASTE_WEBSITE_BOOKING_KEY_HERE>',
--   'website_booking_key',
--   'Shared secret between the NexDrive website Server Actions and the website booking functions');
--
-- To rotate later:
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'website_booking_key'),
--   '<NEW_VALUE>');
