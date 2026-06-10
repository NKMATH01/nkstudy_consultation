-- Integrity constraints and lookup indexes.
-- File only: apply after user approval.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_branch_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_branch_check
      check (branch in ('gojan-math', 'gojan-eng', 'zai-both'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_consult_type_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_consult_type_check
      check (consult_type in ('phone', 'inperson'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_subject_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_subject_check
      check (subject in ('math', 'eng', 'both'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_pay_method_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_pay_method_check
      check (pay_method in ('done', 'later', 'will'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'teachers_role_check'
      and conrelid = 'public.teachers'::regclass
  ) then
    alter table public.teachers
      add constraint teachers_role_check
      check (role in ('teacher', 'clinic', 'admin', 'director', 'principal', 'manager', 'staff'))
      not valid;
  end if;
end $$;

create index if not exists idx_students_teacher_id
  on public.students (teacher_id);

create index if not exists idx_students_clinic_teacher_id
  on public.students (clinic_teacher_id);

create index if not exists idx_bookings_branch
  on public.bookings (branch);
