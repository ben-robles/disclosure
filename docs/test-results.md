# Test results

About 15 photos: a regression harness, not a validation study. Judge scores are probabilities from a text-only model reading Gemma's words.

## Prompt v3

- Prompt version: v3
- Model tag: gemma4:e4b
- Run: 2026-10-24 21:33
- Matched expected (exact_match): 12 of 17
- Judge: 12 photos scored; mean mentions_expected_p 0.52, mean type_consistent_p 0.69 (prompt v3)
- Raw per-photo JSON: data\eval\20261024-213341-v3

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 1_year | high | ok | 6.7 s | yes | 0.88 | 0.94 | ok |
| water_ceiling_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 8.5 s | yes | 0.56 | 0.94 | ok |
| mold_bathroom.jpg | mold_mildew | hvac_heating | 1 | 1_year | medium | ok | 7.7 s | NO | 0.05 | 0.02 | ok |
| structural_brick_crack.jpg | foundation_structural | foundation_structural | 3 | 1_year | high | ok | 9.4 s | yes | 0.55 | 0.86 | ok |
| electrical_open_switches.jpg | electrical | electrical | 4 | immediate | high | ok | 5.9 s | yes | 0.51 | 0.95 | ok |
| electrical_scorched_outlet.jpg | electrical | electrical | 4 | immediate | high | ok | 5.1 s | yes | 0.89 | 0.97 | ok |
| plumbing_ptrap_leak.jpg | plumbing | plumbing | 3 | 30_days | high | blurry | 6.1 s | NO | 0.67 | 0.96 | ok |
| window_frame_rot.jpg | window_door_rot | pest_wood_damage | 4 | 30_days | high | ok | 9.3 s | NO | 0.22 | 0.18 | ok |
| door_frame_rot.jpg | window_door_rot | siding_exterior | 3 | 30_days | high | ok | 8.0 s | NO | 0.44 | 0.45 | ok |
| pest_termite_house.jpg | pest_wood_damage | water_intrusion | 4 | immediate | high | ok | 8.2 s | NO | 0.05 | 0.06 | ok |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 7.0 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 7.2 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | high | ok | 7.7 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.5 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.2 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | water_intrusion | 2 | 30_days | high | ok | 7.8 s | yes | 0.76 | 0.95 | ok |
| gate0_chimney_spalling.jpg | chimney_fireplace | chimney_fireplace | 4 | 30_days | high | ok | 7.6 s | yes | 0.68 | 0.97 | ok |

## Prompt v3.1

- Prompt version: v3.1
- Model tag: gemma4:e4b
- Run: 2026-10-24 22:04
- Matched expected (exact_match): 10 of 17
- Judge: 0 photos scored; mean mentions_expected_p n/a, mean type_consistent_p n/a (prompt v3.1)
- Raw per-photo JSON: data\eval\20261024-220417-v3.1

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 30_days | high | ok | 7.5 s | yes |  |  | skipped |
| water_ceiling_stain.jpg | water_intrusion | wall_ceiling_finishes | 2 | 30_days | high | ok | 8.1 s | NO |  |  | skipped |
| mold_bathroom.jpg | mold_mildew | unclear | 1 | cosmetic | medium | ok | 7.7 s | NO |  |  | skipped |
| structural_brick_crack.jpg | foundation_structural | siding_exterior | 4 | 30_days | high | ok | 7.4 s | NO |  |  | skipped |
| electrical_open_switches.jpg | electrical | electrical | 3 | immediate | high | ok | 6.3 s | yes |  |  | skipped |
| electrical_scorched_outlet.jpg | electrical | electrical | 5 | immediate | high | ok | 4.7 s | yes |  |  | skipped |
| plumbing_ptrap_leak.jpg | plumbing | plumbing | 3 | 30_days | high | ok | 6.4 s | yes |  |  | skipped |
| window_frame_rot.jpg | window_door_rot | deck_porch | 4 | 30_days | high | ok | 8.5 s | NO |  |  | skipped |
| door_frame_rot.jpg | window_door_rot | siding_exterior | 3 | 30_days | medium | ok | 7.9 s | NO |  |  | skipped |
| pest_termite_house.jpg | pest_wood_damage | water_intrusion | 4 | 30_days | high | ok | 9.6 s | NO |  |  | skipped |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.1 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 8.2 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | low | ok | 8.0 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 5.7 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.1 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | wall_ceiling_finishes | 2 | cosmetic | high | ok | 8.3 s | NO |  |  | skipped |
| gate0_chimney_spalling.jpg | chimney_fireplace | chimney_fireplace | 3 | 30_days | high | ok | 8.3 s | yes |  |  | skipped |

## Prompt v3.2

- Prompt version: v3.2
- Model tag: gemma4:e4b
- Run: 2026-10-24 22:06
- Matched expected (exact_match): 12 of 17
- Judge: 12 photos scored; mean mentions_expected_p 0.48, mean type_consistent_p 0.64 (prompt v3.2)
- Raw per-photo JSON: data\eval\20261024-220630-v3.2

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 1_year | high | ok | 6.8 s | yes | 0.88 | 0.94 | ok |
| water_ceiling_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 8.7 s | yes | 0.46 | 0.89 | ok |
| mold_bathroom.jpg | mold_mildew | unclear | 1 | cosmetic | low | ok | 8.2 s | NO | 0.05 | 0.02 | ok |
| structural_brick_crack.jpg | foundation_structural | siding_exterior | 3 | 1_year | high | ok | 7.7 s | NO | 0.19 | 0.27 | ok |
| electrical_open_switches.jpg | electrical | electrical | 4 | 30_days | high | ok | 6.4 s | yes | 0.50 | 0.96 | ok |
| electrical_scorched_outlet.jpg | electrical | electrical | 4 | immediate | high | ok | 5.4 s | yes | 0.90 | 0.97 | ok |
| plumbing_ptrap_leak.jpg | plumbing | plumbing | 3 | 30_days | high | ok | 6.5 s | yes | 0.67 | 0.96 | ok |
| window_frame_rot.jpg | window_door_rot | pest_wood_damage | 4 | 30_days | high | ok | 8.3 s | NO | 0.25 | 0.21 | ok |
| door_frame_rot.jpg | window_door_rot | siding_exterior | 3 | 1_year | high | ok | 8.2 s | NO | 0.48 | 0.46 | ok |
| pest_termite_house.jpg | pest_wood_damage | water_intrusion | 4 | 30_days | high | ok | 8.8 s | NO | 0.05 | 0.05 | ok |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 5.6 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | high | not_a_house | 6.9 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | high | ok | 7.4 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.1 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.6 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | water_intrusion | 3 | 30_days | high | ok | 7.7 s | yes | 0.71 | 0.95 | ok |
| gate0_chimney_spalling.jpg | chimney_fireplace | chimney_fireplace | 3 | 1_year | high | ok | 10.2 s | yes | 0.63 | 0.97 | ok |

## Prompt v4

- Prompt version: v4
- Model tag: gemma4:e4b
- Run: 2026-10-24 21:35
- Matched expected (exact_match): 10 of 17
- Judge: 12 photos scored; mean mentions_expected_p 0.54, mean type_consistent_p 0.69 (prompt v4)
- Raw per-photo JSON: data\eval\20261024-213547-v4

| photo | expected | got | severity | urgency | confidence | quality | latency | exact_match | mentions_expected_p | type_consistent_p | judge_status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| roof_shingles.jpg | roof | roof | 3 | 1_year | high | ok | 7.0 s | yes | 0.96 | 0.97 | ok |
| water_ceiling_stain.jpg | water_intrusion | wall_ceiling_finishes | 2 | cosmetic | high | ok | 6.7 s | NO | 0.11 | 0.26 | ok |
| mold_bathroom.jpg | mold_mildew | water_intrusion | 2 | cosmetic | high | ok | 6.3 s | NO | 0.24 | 0.31 | ok |
| structural_brick_crack.jpg | foundation_structural | foundation_structural | 3 | 1_year | medium | ok | 6.1 s | yes | 0.60 | 0.91 | ok |
| electrical_open_switches.jpg | electrical | electrical | 4 | immediate | high | ok | 5.6 s | yes | 0.55 | 0.94 | ok |
| electrical_scorched_outlet.jpg | electrical | electrical | 4 | immediate | high | ok | 5.1 s | yes | 0.90 | 0.96 | ok |
| plumbing_ptrap_leak.jpg | plumbing | unclear | 3 | 30_days | low | blurry | 5.3 s | NO | 0.75 | 0.95 | ok |
| window_frame_rot.jpg | window_door_rot | pest_wood_damage | 4 | immediate | high | ok | 7.0 s | NO | 0.48 | 0.48 | ok |
| door_frame_rot.jpg | window_door_rot | window_door_rot | 3 | 30_days | high | ok | 6.4 s | yes | 0.73 | 0.95 | ok |
| pest_termite_house.jpg | pest_wood_damage | wall_ceiling_finishes | 4 | 30_days | medium | ok | 8.1 s | NO | 0.17 | 0.18 | ok |
| not_house_cat.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.3 s | yes |  |  | skipped |
| not_house_road.jpg | not_a_house | unclear | 1 | cosmetic | low | not_a_house | 6.1 s | yes |  |  | skipped |
| normal_empty_room.jpg | normal | unclear | 1 | cosmetic | low | ok | 7.3 s | yes |  |  | skipped |
| blurry_light_switch.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.5 s | yes |  |  | skipped |
| blurry_wiring.jpg | blurry | unclear | 1 | cosmetic | low | blurry | 6.3 s | yes |  |  | skipped |
| gate0_water_stain.jpg | water_intrusion | wall_ceiling_finishes | 2 | cosmetic | high | ok | 6.7 s | NO | 0.53 | 0.65 | ok |
| gate0_chimney_spalling.jpg | chimney_fireplace | unclear | 4 | 30_days | low | ok | 6.2 s | NO | 0.51 | 0.76 | ok |
