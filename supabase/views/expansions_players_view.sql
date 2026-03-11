/* This view extends the `collections_games` view by adding
the `min_exp_players` and `max_exp_players` columns. These are
intended for determining the "expanded" player counts from game expansions,
such as a max player count of 6 for Catan when the 5-6 player expansion is owned:

* `min_exp_players`: The minimum value of `min_players` out of
  all of a user's owned expansions for a particular game

* `max_exp_players`: The maximum value of `max_players` out of
  all of a user's owned expansions for a particular game

If the user does not own any expansions for a particular game,
these columns will be NULL. */

drop view expansions_players_view;

create or replace view expansions_players_view with (security_invoker = on) as
  select
    collections_games.*,
    e.min_exp_players,
    e.max_exp_players
  from 
    collections_games
    left join (
      select
        base.user_id,
        base.bgg_game_id,
        min(exp.min_players) as min_exp_players,
        max(exp.max_players) as max_exp_players
      from
        collections as base
        join expansions on base.bgg_game_id = expansions.base_id
        join collections_games as exp
          on expansions.expansion_id = exp.bgg_game_id
          and base.user_id = exp.user_id
      group by base.user_id, base.bgg_game_id
    ) as e
      on collections_games.user_id = e.user_id
      and collections_games.bgg_game_id = e.bgg_game_id
  where collections_games.is_expansion = false