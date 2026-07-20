-- Allow top_scorer & best_goalkeeper in tournament results tables.
-- The V6 migration created these CHECK constraints before the two award
-- types were added to the app, so saving them via /admin/results failed.

ALTER TABLE public.tournament_results
  DROP CONSTRAINT tournament_results_prediction_type_check;
ALTER TABLE public.tournament_results
  ADD CONSTRAINT tournament_results_prediction_type_check
  CHECK (prediction_type IN ('winner', 'best_player', 'best_young', 'surprise_team', 'top_scorer', 'best_goalkeeper'));

ALTER TABLE public.global_prediction_points
  DROP CONSTRAINT global_prediction_points_prediction_type_check;
ALTER TABLE public.global_prediction_points
  ADD CONSTRAINT global_prediction_points_prediction_type_check
  CHECK (prediction_type IN ('winner', 'best_player', 'best_young', 'surprise_team', 'top_scorer', 'best_goalkeeper'));
