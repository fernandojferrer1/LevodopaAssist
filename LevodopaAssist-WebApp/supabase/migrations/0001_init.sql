-- LevodopaAssist — schema inicial equivalente a webapp/backend/prisma/schema.prisma
-- Destino: Postgres (Supabase). IDs text (cuid o uuid) para permitir migración de datos.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Trigger helper: patients.updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table public.patients (
  id            text primary key default gen_random_uuid()::text,
  full_name     text not null,
  age           integer not null,
  national_id   text,
  diagnosis     text,
  notes         text,
  extra_fields  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint patients_national_id_key unique (national_id)
);

create trigger patients_set_updated_at
  before update on public.patients
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- measurements
-- ---------------------------------------------------------------------------
create table public.measurements (
  id                          text primary key default gen_random_uuid()::text,
  patient_id                  text not null references public.patients (id) on delete restrict,
  sequence_number             integer not null,
  medication_state            text not null,
  measured_at                 timestamptz not null,
  location                    text,
  notes                       text,
  status                      text not null default 'completed',
  con_num                     integer not null,
  timer_medicion_ms           double precision not null,
  con_x_minuto                double precision not null,
  peak_max                    double precision not null,
  promedio_peaks              double precision not null,
  yyn                         double precision not null,
  promedio_lth_ms             double precision not null,
  promedio_btw_ms             double precision not null,
  thresh                      double precision not null,
  amplitude_decrement_pct     double precision,
  duration_decrement_pct      double precision,
  duration_cv_pct             double precision,
  peak_to_base_ratio          double precision,
  iemg                        double precision,
  resting_tone_mv             double precision,
  incomplete_relaxation_pct   double precision,
  detection_source            text not null default 'firmware',
  detection_note              text,
  raw_samples_json            text,
  created_at                  timestamptz not null default now(),
  constraint measurements_medication_state_check
    check (medication_state in ('sin_levodopa', 'post_levodopa')),
  constraint measurements_status_check
    check (status in ('completed', 'aborted')),
  constraint measurements_detection_source_check
    check (detection_source in ('firmware', 'backend')),
  constraint measurements_patient_id_sequence_number_key
    unique (patient_id, sequence_number)
);

create index measurements_patient_id_measured_at_idx
  on public.measurements (patient_id, measured_at desc);

-- ---------------------------------------------------------------------------
-- measurement_contractions
-- ---------------------------------------------------------------------------
create table public.measurement_contractions (
  id              text primary key default gen_random_uuid()::text,
  measurement_id  text not null references public.measurements (id) on delete restrict,
  sequence_index  integer not null,
  amplitude       double precision not null,
  duration_ms     double precision not null,
  truncated       boolean not null default false
);

create index measurement_contractions_measurement_id_sequence_index_idx
  on public.measurement_contractions (measurement_id, sequence_index);

-- ---------------------------------------------------------------------------
-- comparisons
-- ---------------------------------------------------------------------------
create table public.comparisons (
  id                 text primary key default gen_random_uuid()::text,
  patient_id         text not null references public.patients (id) on delete restrict,
  measurement_a_id   text not null references public.measurements (id) on delete restrict,
  measurement_b_id   text not null references public.measurements (id) on delete restrict,
  metrics_json       text not null,
  created_at         timestamptz not null default now()
);

create index comparisons_patient_id_idx
  on public.comparisons (patient_id);

create index comparisons_measurement_a_id_idx
  on public.comparisons (measurement_a_id);

create index comparisons_measurement_b_id_idx
  on public.comparisons (measurement_b_id);

-- ---------------------------------------------------------------------------
-- RLS: habilitado, sin policies → Data API (anon/authenticated) cerrada.
-- El backend con service_role bypasea RLS.
-- ---------------------------------------------------------------------------
alter table public.patients enable row level security;
alter table public.measurements enable row level security;
alter table public.measurement_contractions enable row level security;
alter table public.comparisons enable row level security;

-- ---------------------------------------------------------------------------
-- RPC: create_measurement
-- ---------------------------------------------------------------------------
create or replace function public.create_measurement(
  p_patient_id text,
  p_measurement jsonb,
  p_contractions jsonb
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_measurement_id text;
  v_sequence_number integer;
  v_contraction jsonb;
begin
  -- Bloqueo de fila del paciente: serializa sequence_number entre requests concurrentes.
  perform 1 from public.patients where id = p_patient_id for update;
  if not found then
    raise exception 'patient not found: %', p_patient_id
      using errcode = 'P0002';
  end if;

  select coalesce(max(m.sequence_number), 0) + 1
    into v_sequence_number
  from public.measurements m
  where m.patient_id = p_patient_id;

  v_measurement_id := coalesce(p_measurement->>'id', gen_random_uuid()::text);

  insert into public.measurements (
    id,
    patient_id,
    sequence_number,
    medication_state,
    measured_at,
    location,
    notes,
    status,
    con_num,
    timer_medicion_ms,
    con_x_minuto,
    peak_max,
    promedio_peaks,
    yyn,
    promedio_lth_ms,
    promedio_btw_ms,
    thresh,
    amplitude_decrement_pct,
    duration_decrement_pct,
    duration_cv_pct,
    peak_to_base_ratio,
    iemg,
    resting_tone_mv,
    incomplete_relaxation_pct,
    detection_source,
    detection_note,
    raw_samples_json
  ) values (
    v_measurement_id,
    p_patient_id,
    v_sequence_number,
    p_measurement->>'medication_state',
    (p_measurement->>'measured_at')::timestamptz,
    p_measurement->>'location',
    p_measurement->>'notes',
    coalesce(p_measurement->>'status', 'completed'),
    (p_measurement->>'con_num')::integer,
    (p_measurement->>'timer_medicion_ms')::double precision,
    (p_measurement->>'con_x_minuto')::double precision,
    (p_measurement->>'peak_max')::double precision,
    (p_measurement->>'promedio_peaks')::double precision,
    (p_measurement->>'yyn')::double precision,
    (p_measurement->>'promedio_lth_ms')::double precision,
    (p_measurement->>'promedio_btw_ms')::double precision,
    (p_measurement->>'thresh')::double precision,
    (p_measurement->>'amplitude_decrement_pct')::double precision,
    (p_measurement->>'duration_decrement_pct')::double precision,
    (p_measurement->>'duration_cv_pct')::double precision,
    (p_measurement->>'peak_to_base_ratio')::double precision,
    (p_measurement->>'iemg')::double precision,
    (p_measurement->>'resting_tone_mv')::double precision,
    (p_measurement->>'incomplete_relaxation_pct')::double precision,
    coalesce(p_measurement->>'detection_source', 'firmware'),
    p_measurement->>'detection_note',
    p_measurement->>'raw_samples_json'
  );

  for v_contraction in
    select value from jsonb_array_elements(coalesce(p_contractions, '[]'::jsonb))
  loop
    insert into public.measurement_contractions (
      id,
      measurement_id,
      sequence_index,
      amplitude,
      duration_ms,
      truncated
    ) values (
      coalesce(v_contraction->>'id', gen_random_uuid()::text),
      v_measurement_id,
      (v_contraction->>'sequence_index')::integer,
      (v_contraction->>'amplitude')::double precision,
      (v_contraction->>'duration_ms')::double precision,
      coalesce((v_contraction->>'truncated')::boolean, false)
    );
  end loop;

  return v_measurement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete_measurement
-- ---------------------------------------------------------------------------
create or replace function public.delete_measurement(p_measurement_id text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.measurements where id = p_measurement_id
  ) then
    return false;
  end if;

  delete from public.comparisons
  where measurement_a_id = p_measurement_id
     or measurement_b_id = p_measurement_id;

  delete from public.measurement_contractions
  where measurement_id = p_measurement_id;

  delete from public.measurements
  where id = p_measurement_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios RPC: solo service_role
-- ---------------------------------------------------------------------------
revoke all on function public.create_measurement(text, jsonb, jsonb) from public;
revoke all on function public.create_measurement(text, jsonb, jsonb) from anon;
revoke all on function public.create_measurement(text, jsonb, jsonb) from authenticated;
grant execute on function public.create_measurement(text, jsonb, jsonb) to service_role;

revoke all on function public.delete_measurement(text) from public;
revoke all on function public.delete_measurement(text) from anon;
revoke all on function public.delete_measurement(text) from authenticated;
grant execute on function public.delete_measurement(text) to service_role;

-- ---------------------------------------------------------------------------
-- Verificación manual (SQL Editor) — descomentar para probar
-- ---------------------------------------------------------------------------
/*
-- 1) Paciente de prueba
insert into public.patients (full_name, age, national_id)
values ('Paciente Prueba', 65, '99999999')
returning id;
-- (copiá el id devuelto como :patient_id)

-- 2) Crear medición + contracciones
select public.create_measurement(
  '<patient_id>',
  jsonb_build_object(
    'medication_state', 'sin_levodopa',
    'measured_at', now(),
    'location', 'laboratorio',
    'notes', null,
    'status', 'completed',
    'con_num', 2,
    'timer_medicion_ms', 10000,
    'con_x_minuto', 12,
    'peak_max', 2500,
    'promedio_peaks', 1800,
    'yyn', 1300,
    'promedio_lth_ms', 300,
    'promedio_btw_ms', 400,
    'thresh', 1700,
    'amplitude_decrement_pct', 1.5,
    'duration_decrement_pct', -2.0,
    'duration_cv_pct', 12.0,
    'peak_to_base_ratio', 1.9,
    'iemg', 15000,
    'resting_tone_mv', 1400,
    'incomplete_relaxation_pct', 2.5,
    'detection_source', 'backend',
    'detection_note', null,
    'raw_samples_json', '[1000,1001,1002]'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'sequence_index', 0,
      'amplitude', 1800,
      'duration_ms', 280,
      'truncated', false
    ),
    jsonb_build_object(
      'sequence_index', 1,
      'amplitude', 1750,
      'duration_ms', 260,
      'truncated', true
    )
  )
);
-- (copiá el id devuelto como :measurement_id)

-- 3) Controles
select sequence_number, con_num, detection_source
from public.measurements
where id = '<measurement_id>';

select sequence_index, amplitude, truncated
from public.measurement_contractions
where measurement_id = '<measurement_id>'
order by sequence_index;

-- 4) Segunda medición al mismo paciente → sequence_number = 2
-- (repetir create_measurement con el mismo patient_id)

-- 5) Borrado
select public.delete_measurement('<measurement_id>');
-- debe devolver true; una segunda llamada debe devolver false

-- 6) Limpieza
-- delete from public.patients where national_id = '99999999';
*/
