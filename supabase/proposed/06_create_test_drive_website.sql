-- 06: Website test-drive booking. NEW function; no existing function is modified.
-- Body is create_test_drive_atomic with exactly two behavioural differences:
--   status     'Confirmed'   -> 'Requested'
--   created_by 'Voice Agent' -> 'Website'
-- Same validation, same row locks, same conflict checks, same advisory lock keys
-- ('nexdrive:appointment:lead:', 'nexdrive:appointment:slot:', 'nexdrive:appointment-id'),
-- same MAX+1 ID generator, same error codes. Notes are trimmed and capped at 2000 chars.
-- It does not require the Retell key. The app calls it only from a Server Action.
create or replace function public.create_test_drive_website(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    v_lead_id TEXT := p_request->>'lead_id';
    v_customer_id TEXT := p_request->>'customer_id';
    v_vehicle_id TEXT := p_request->>'vehicle_id';
    v_salesperson_id TEXT := p_request->>'salesperson_id';
    v_date DATE;
    v_time TIME;
    v_lead public.leads%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;
    v_person public.salespeople%ROWTYPE;
    v_existing public.appointments%ROWTYPE;
    v_created public.appointments%ROWTYPE;
    v_appointment_id TEXT;
    v_constraint TEXT;
BEGIN
    IF v_lead_id IS NULL OR v_lead_id !~ '^LEAD-[0-9]{6}$'
       OR v_customer_id IS NULL OR v_customer_id !~ '^CUST-[0-9]{6}$'
       OR v_vehicle_id IS NULL OR v_vehicle_id !~ '^VEH-[0-9]{6}$'
       OR v_salesperson_id IS NULL OR v_salesperson_id !~ '^SP-[0-9]{3}$' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_BOOKING_REFERENCE', 'message', 'One or more booking IDs are invalid');
    END IF;

    BEGIN
        v_date := (p_request->>'appointment_date')::DATE;
        v_time := (p_request->>'appointment_time')::TIME;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment date or time is invalid');
    END;
    IF v_date IS NULL OR v_time IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment date and time are required');
    END IF;
    IF v_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'PAST_APPOINTMENT_DATE', 'message', 'Appointment date cannot be in the past');
    END IF;
    IF EXTRACT(MINUTE FROM v_time)::INTEGER NOT IN (0, 30)
       OR EXTRACT(SECOND FROM v_time) <> 0 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_APPOINTMENT_TIME', 'message', 'Appointment time must use a 30-minute increment');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('nexdrive:appointment:lead:' || v_lead_id, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended(
        'nexdrive:appointment:slot:' || v_salesperson_id || ':' || v_date::TEXT || ':' || v_time::TEXT,
        0
    ));

    SELECT * INTO v_existing FROM public.appointments
    WHERE lead_id = v_lead_id LIMIT 1 FOR UPDATE;
    IF FOUND THEN
        IF v_existing.appointment_type = 'Test Drive'
           AND v_existing.status IN ('Requested', 'Confirmed', 'Rescheduled')
           AND v_existing.appointment_date >= CURRENT_DATE
           AND v_existing.customer_id = v_customer_id
           AND v_existing.vehicle_id = v_vehicle_id
           AND v_existing.salesperson_id = v_salesperson_id
           AND v_existing.appointment_date = v_date
           AND v_existing.appointment_time = v_time THEN
            RETURN jsonb_build_object('success', true, 'created', false, 'appointment', to_jsonb(v_existing));
        END IF;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EXISTING_APPOINTMENT_CONFLICT',
            'message', 'This lead already has a different appointment',
            'existing_appointment', jsonb_build_object(
                'appointment_id', v_existing.appointment_id,
                'appointment_date', v_existing.appointment_date,
                'appointment_time', v_existing.appointment_time,
                'status', v_existing.status)
        );
    END IF;

    SELECT * INTO v_lead FROM public.leads WHERE lead_id = v_lead_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'LEAD_NOT_FOUND', 'message', 'Lead not found');
    END IF;
    IF v_lead.customer_id <> v_customer_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'LEAD_CUSTOMER_MISMATCH', 'message', 'Lead does not belong to customer');
    END IF;
    PERFORM 1 FROM public.customers WHERE customer_id = v_customer_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'CUSTOMER_NOT_FOUND', 'message', 'Customer not found');
    END IF;
    SELECT * INTO v_vehicle FROM public.vehicles WHERE vehicle_id = v_vehicle_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'VEHICLE_NOT_FOUND', 'message', 'Vehicle not found');
    END IF;
    IF v_vehicle.vehicle_status NOT IN ('Available', 'Demo Vehicle')
       OR NOT v_vehicle.test_drive_available THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'VEHICLE_NOT_AVAILABLE_FOR_TEST_DRIVE', 'message', 'This vehicle is not currently available for a test drive');
    END IF;
    SELECT * INTO v_person FROM public.salespeople
    WHERE salesperson_id = v_salesperson_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'SALESPERSON_NOT_FOUND', 'message', 'Salesperson not found');
    END IF;
    IF NOT v_person.active THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'SALESPERSON_UNAVAILABLE', 'message', 'Salesperson is unavailable');
    END IF;
    IF NOT (TO_CHAR(v_date, 'FMDay') = ANY(v_person.working_days))
       OR NOT (v_person.shift_start <= v_time AND v_time < v_person.shift_end) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'OUTSIDE_SALESPERSON_SHIFT', 'message', 'Requested time is outside the salesperson shift');
    END IF;
    PERFORM 1 FROM public.appointments
    WHERE salesperson_id = v_salesperson_id
      AND appointment_date = v_date
      AND appointment_time = v_time
      AND status IN ('Requested', 'Confirmed', 'Rescheduled')
    LIMIT 1 FOR UPDATE;
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_SLOT_UNAVAILABLE', 'message', 'The requested appointment time is no longer available');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('nexdrive:appointment-id', 0));
    SELECT 'APT-' || LPAD((COALESCE(MAX(SUBSTRING(appointment_id FROM 5)::INTEGER), 0) + 1)::TEXT, 6, '0')
    INTO v_appointment_id FROM public.appointments;
    BEGIN
        INSERT INTO public.appointments (
            appointment_id, lead_id, customer_id, vehicle_id, salesperson_id,
            appointment_date, appointment_time, appointment_type, status,
            created_by, notes, created_at, updated_at
        ) VALUES (
            v_appointment_id, v_lead_id, v_customer_id, v_vehicle_id,
            v_salesperson_id, v_date, v_time, 'Test Drive', 'Requested',
            'Website', LEFT(TRIM(COALESCE(p_request->>'notes', '')), 2000), NOW(), NOW()
        ) RETURNING * INTO v_created;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'appointments_active_salesperson_slot_uniq' THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'APPOINTMENT_SLOT_UNAVAILABLE', 'message', 'The requested appointment time is no longer available');
        END IF;
        RETURN jsonb_build_object('success', false, 'error_code', 'EXISTING_APPOINTMENT_CONFLICT', 'message', 'This lead already has a different appointment');
    END;
    RETURN jsonb_build_object('success', true, 'created', true, 'appointment', to_jsonb(v_created));
END;
$function$;

revoke all on function public.create_test_drive_website(jsonb) from public;
grant execute on function public.create_test_drive_website(jsonb) to anon, authenticated;
