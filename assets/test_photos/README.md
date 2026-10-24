# Test photos

15 photos from Wikimedia Commons. Each one's license was read on its Commons page. Source, author, license and changes for every file are in [`test_photos.csv`](test_photos.csv).

Two extra Gate 0 fixtures (`gate0_*.jpg`, a ceiling stain and spalling chimney bricks, expected `chimney_fireplace`) are described in [ATTRIBUTION.md](ATTRIBUTION.md). They are a vision smoke check, not part of the adversarial set; severity and urgency are not ground-truth inspection labels.

| Expected | Files |
|---|---|
| `roof` | roof_shingles.jpg |
| `water_intrusion` | water_ceiling_stain.jpg |
| `mold_mildew` | mold_bathroom.jpg |
| `foundation_structural` | structural_brick_crack.jpg |
| `electrical` | electrical_open_switches.jpg, electrical_scorched_outlet.jpg |
| `plumbing` | plumbing_ptrap_leak.jpg |
| `window_door_rot` | window_frame_rot.jpg, door_frame_rot.jpg |
| `pest_wood_damage` | pest_termite_house.jpg |
| `not_a_house` | not_house_cat.jpg, not_house_road.jpg |
| `normal` | normal_empty_room.jpg |
| `blurry` | blurry_light_switch.jpg, blurry_wiring.jpg |

Licenses: CC0, CC BY 2.0/3.0, CC BY-SA 2.0/3.0/4.0. The CC BY and CC BY-SA photos need the author credit in `test_photos.csv` kept with them. Larger originals were downscaled to 1280 px wide and every file was re-encoded as JPEG. `blurry_wiring.jpg` is a CC0 photo with a Gaussian blur (radius 14) added to test the blurry guardrail. These changes to the CC BY-SA photos are themselves under the same CC BY-SA license as the original.

No photo shows the `unclear` type on purpose; `unclear` is an outcome, not a defect to photograph.

Run the set (needs Ollama and the model):

```powershell
.venv\Scripts\python scripts\run_test_set.py
```

Results go to `docs/test-results.md`. Never add a photo whose license you have not read.
