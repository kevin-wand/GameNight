create or replace view polls_profiles with (security_invoker = on) as
  select
    polls.*,
    profiles.username,
    profiles.firstname,
    profiles.lastname
  from
    polls
    left join profiles on polls.user_id = profiles.id