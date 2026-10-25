# Test results

About 15 photos: a regression harness, not a validation study. Judge scores are probabilities from a text-only model reading Gemma's words.

## Prompt v3

- Prompt version: v3
- Model tag: gemma4:e4b
- Run: 2026-10-24 21:26
- Matched expected (exact_match): 12 of 17
- Judge: 12 photos scored; mean mentions_expected_p 0.52, mean type_consistent_p 0.67 (prompt v3)
- Raw per-photo JSON: data\eval\20261024-212619-v3

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 1_year | high | ok | 61.8 s | yes | 0.87 | 0.92 | ok |
| water_ceiling_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 20.8 s | yes | 0.51 | 0.86 | ok |
| mold_bathroom.jpg | mold_mildew | unclear | 1 | cosmetic | high | ok | 8.0 s | NO | 0.04 | 0.02 | ok |
| structural_brick_crack.jpg | foundation_structural | siding_exterior | 3 | 1_year | high | ok | 7.9 s | NO | 0.51 | 0.69 | ok |
| electrical_open_switches.jpg | electrical | electrical | 4 | immediate | high | ok | 5.8 s | yes | 0.46 | 0.95 | ok |
| electrical_scorched_outlet.jpg | electrical | electrical | 4 | immediate | high | ok | 5.6 s | yes | 0.85 | 0.97 | ok |
| plumbing_ptrap_leak.jpg | plumbing | plumbing | 3 | 30_days | high | ok | 6.7 s | yes | 0.90 | 0.97 | ok |
| window_frame_rot.jpg | window_door_rot | pest_wood_damage | 4 | 30_days | high | ok | 9.0 s | NO | 0.23 | 0.20 | ok |
| door_frame_rot.jpg | window_door_rot | siding_exterior | 3 | 30_days | high | ok | 21.2 s | NO | 0.44 | 0.43 | ok |
| pest_termite_house.jpg | pest_wood_damage | water_intrusion | 4 | 30_days | high | ok | 8.5 s | NO | 0.05 | 0.05 | ok |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.6 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.9 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | low | ok | 7.3 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.5 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.2 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 8.3 s | yes | 0.74 | 0.96 | ok |
| gate0_chimney_spalling.jpg | chimney_fireplace | chimney_fireplace | 4 | 30_days | high | ok | 9.1 s | yes | 0.66 | 0.97 | ok |

## Prompt v4

- Prompt version: v4
- Model tag: gemma4:e4b
- Run: 2026-10-24 21:29
- Matched expected (exact_match): 10 of 17
- Judge: 12 photos scored; mean mentions_expected_p 0.51, mean type_consistent_p 0.63 (prompt v4)
- Raw per-photo JSON: data\eval\20261024-212948-v4

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 30_days | high | ok | 8.0 s | yes | 0.96 | 0.97 | ok |
| water_ceiling_stain.jpg | water_intrusion | wall_ceiling_finishes | 3 | 30_days | high | ok | 6.5 s | NO | 0.14 | 0.28 | ok |
| mold_bathroom.jpg | mold_mildew | water_intrusion | 2 | 30_days | high | ok | 6.5 s | NO | 0.26 | 0.32 | ok |
| structural_brick_crack.jpg | foundation_structural | foundation_structural | 4 | 1_year | high | ok | 5.3 s | yes | 0.59 | 0.90 | ok |
| electrical_open_switches.jpg | electrical | wall_ceiling_finishes | 3 | 30_days | medium | ok | 6.4 s | NO | 0.18 | 0.25 | ok |
| electrical_scorched_outlet.jpg | electrical | electrical | 4 | immediate | high | ok | 5.3 s | yes | 0.88 | 0.97 | ok |
| plumbing_ptrap_leak.jpg | plumbing | unclear | 3 | 30_days | low | blurry | 5.9 s | NO | 0.72 | 0.95 | ok |
| window_frame_rot.jpg | window_door_rot | pest_wood_damage | 4 | immediate | medium | ok | 6.8 s | NO | 0.32 | 0.28 | ok |
| door_frame_rot.jpg | window_door_rot | window_door_rot | 3 | 30_days | high | ok | 6.1 s | yes | 0.74 | 0.96 | ok |
| pest_termite_house.jpg | pest_wood_damage | water_intrusion | 4 | 30_days | high | ok | 8.0 s | NO | 0.05 | 0.05 | ok |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.5 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 5.2 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | low | ok | 6.9 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.6 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.5 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 7.0 s | yes | 0.74 | 0.93 | ok |
| gate0_chimney_spalling.jpg | chimney_fireplace | unclear | 4 | 30_days | low | ok | 6.2 s | NO | 0.54 | 0.75 | ok |
