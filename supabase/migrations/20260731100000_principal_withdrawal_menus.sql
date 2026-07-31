-- 원장(principal) 계정에 퇴원 회고·강사 러닝 뷰 메뉴를 부여한다.
-- 배경: 두 경로의 allowed_menus 보유자가 0명이라 원장이 접근할 수 없었다.
-- 코드 쪽 role 게이트(principal/admin)는 이미 적용됐고, 이 UPDATE는 사이드바
-- allowed_menus 목록까지 맞춰 준다.
--
-- 이미 들어 있으면 배열에 중복 추가하지 않는다(조건 + 중복 제거).
-- File only: apply after user approval.

update public.teachers
set allowed_menus = (
  select array_agg(distinct menu order by menu)
  from unnest(
    coalesce(allowed_menus, array[]::text[])
      || array['/withdrawals/review', '/withdrawals/teachers']
  ) as menu
)
where role = 'principal'
  and (
    allowed_menus is null
    or not (allowed_menus @> array['/withdrawals/review', '/withdrawals/teachers'])
  );

-- 확인용(적용 후 수동 실행):
--   select name, role, allowed_menus from public.teachers where role = 'principal';
