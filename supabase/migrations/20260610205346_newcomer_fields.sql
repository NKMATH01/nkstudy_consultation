-- Newcomer survey/consultation supplemental fields.
-- File only: apply after user approval.

alter table public.surveys
  add column if not exists mock_exam_score text,
  add column if not exists target_university text,
  add column if not exists weekly_study_hours text,
  add column if not exists available_time text,
  add column if not exists commute_method text,
  add column if not exists commute_distance text,
  add column if not exists sibling_enrolled text,
  add column if not exists parent_expectation text,
  add column if not exists mbti text,
  add column if not exists health_note text;

alter table public.consultations
  add column if not exists student_id uuid references public.students(id),
  add column if not exists decision_maker text,
  add column if not exists follow_up_date date,
  add column if not exists mock_exam_score text,
  add column if not exists sibling_enrolled text,
  add column if not exists parent_expectation text;
