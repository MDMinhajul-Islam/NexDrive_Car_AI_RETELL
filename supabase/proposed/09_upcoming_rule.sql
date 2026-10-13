-- 09_upcoming_rule.sql
-- create or replace for two functions. Nothing else: no grants, tables or policies.
-- (create or replace keeps each function's existing owner and execute grants.)
--
-- Change: an existing appointment on the customer's most recent open lead now counts as
-- "upcoming" only when BOTH are true:
--     status in ('Requested', 'Confirmed', 'Rescheduled')
--     appointment_date >= today in America/Chicago
-- Before, 07 looked at the status alone, so an old Confirmed appointment that nobody
-- closed out blocked the customer from booking again.
--
-- Effect of the new rule on the most recent open lead:
--     no appointment                                  reuse the lead        (unchanged)
--     active status, dated today or later             UPCOMING_APPOINTMENT_EXISTS
--     active status, dated before today               open a new lead       (NEW)
--     Completed / Cancelled / No Show                 open a new lead       (unchanged)
--
-- Every other line of both functions is identical to 07_fixes.sql. Changed lines are
-- marked "-- 09".


-- ===========================================================================
-- 1. upsert_lead_website
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
    v_today DATE := (NOW() AT TIME ZONE 'America/Chicago')::DATE;  -- 09: dealership calendar date
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

        IF v_appt.status IN ('Requested', 'Confirmed', 'Rescheduled')
           AND v_appt.appointment_date >= v_today THEN  -- 09: must also be today or later
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
        -- Completed / Cancelled / No Show, or an active status dated before today:
        -- fall through and open a new lead.
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
-- 2. admin_create_appointment
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
  v_today          date := (now() at time zone 'America/Chicago')::date;  -- 09: dealership calendar date
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
      elsif v_existing.status in ('Requested', 'Confirmed', 'Rescheduled')
            and v_existing.appointment_date >= v_today then  -- 09: must also be today or later
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
      -- Completed / Cancelled / No Show, or an active status dated before today:
      -- v_lead_id stays null, a new lead is opened below.
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
