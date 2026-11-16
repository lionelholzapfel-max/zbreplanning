// Zod schemas for the (public, unauthenticated) FPL API. Only the fields we use
// are declared; unknown keys are stripped so the cached snapshot stays small.
import { z } from 'zod';

export const EventSchema = z.object({
  id: z.number(),
  name: z.string(),
  deadline_time: z.string(),
  finished: z.boolean(),
  data_checked: z.boolean(),
  is_current: z.boolean(),
  is_next: z.boolean(),
  average_entry_score: z.number().nullable().catch(null),
  highest_score: z.number().nullable().catch(null),
});

export const ElementSchema = z.object({
  id: z.number(),
  web_name: z.string(),
  first_name: z.string(),
  second_name: z.string(),
  team: z.number(),
  element_type: z.number(), // 1 GK, 2 DEF, 3 MID, 4 FWD
  now_cost: z.number(),
  total_points: z.number(),
  selected_by_percent: z.string(),
  code: z.number(),
});

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_name: z.string(),
});

export const ChipWindowSchema = z.object({
  name: z.string(),
  start_event: z.number(),
  stop_event: z.number(),
});

export const BootstrapSchema = z.object({
  chips: z.array(ChipWindowSchema).catch([]),
  events: z.array(EventSchema),
  elements: z.array(ElementSchema),
  teams: z.array(TeamSchema),
});

export const HistoryGwSchema = z.object({
  event: z.number(),
  points: z.number(),
  total_points: z.number(),
  rank: z.number().nullable().catch(null),
  overall_rank: z.number().nullable().catch(null),
  bank: z.number(),
  value: z.number(),
  event_transfers: z.number(),
  event_transfers_cost: z.number(),
  points_on_bench: z.number(),
});

export const HistorySchema = z.object({
  current: z.array(HistoryGwSchema),
  past: z.array(z.object({ season_name: z.string(), total_points: z.number(), rank: z.number() })),
  chips: z.array(z.object({ name: z.string(), time: z.string(), event: z.number() })),
});

export const PickSchema = z.object({
  element: z.number(),
  position: z.number(),
  multiplier: z.number(),
  is_captain: z.boolean(),
  is_vice_captain: z.boolean(),
});

export const PicksSchema = z.object({
  active_chip: z.string().nullable(),
  automatic_subs: z.array(z.object({ element_in: z.number(), element_out: z.number() })),
  picks: z.array(PickSchema),
});

export const TransferSchema = z.object({
  element_in: z.number(),
  element_in_cost: z.number(),
  element_out: z.number(),
  element_out_cost: z.number(),
  event: z.number(),
  time: z.string(),
});

export const LiveSchema = z.object({
  elements: z.array(
    z.object({
      id: z.number(),
      stats: z.object({
        total_points: z.number(),
        minutes: z.number(),
        goals_scored: z.number(),
        assists: z.number(),
        clean_sheets: z.number(),
        bonus: z.number(),
      }),
    }),
  ),
});

export const EntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  player_first_name: z.string(),
  player_last_name: z.string(),
  summary_overall_points: z.number().nullable().catch(null),
  summary_overall_rank: z.number().nullable().catch(null),
});

export type FplChipWindow = z.infer<typeof ChipWindowSchema>;
export type FplEvent = z.infer<typeof EventSchema>;
export type FplElement = z.infer<typeof ElementSchema>;
export type FplTeam = z.infer<typeof TeamSchema>;
export type FplHistoryGw = z.infer<typeof HistoryGwSchema>;
export type FplHistory = z.infer<typeof HistorySchema>;
export type FplPick = z.infer<typeof PickSchema>;
export type FplPicks = z.infer<typeof PicksSchema>;
export type FplTransfer = z.infer<typeof TransferSchema>;
export type FplLive = z.infer<typeof LiveSchema>;
export type FplEntry = z.infer<typeof EntrySchema>;
