# Test photos

Not added yet (needs the target machine and a license check per photo).

Needed, all openly licensed (Wikimedia Commons CC, Unsplash/Pexels, or US government public domain: FEMA, HUD, EPA, NPS):

- 2 blurry photos (expected `blurry`)
- 2 non-house photos, a cat and a street (expected `not_a_house`)
- 1 normal undamaged wall (expected `normal`)
- 8-10 real defects covering every taxonomy id at least once (expected = the taxonomy id)

Record each in `test_photos.csv` with the columns `file,expected,source_url,license`, then run
`scripts\run_test_set.py`. Never add a photo whose license you have not read.
