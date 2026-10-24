# Test photos

Two licensed Gate 0 fixtures are included: a ceiling stain and spalling chimney bricks.
See [ATTRIBUTION.md](ATTRIBUTION.md) for authors, licenses, modifications and expected
visible details. These two photos are a vision smoke check; they do not complete the
adversarial set below. Severity and urgency are not ground-truth inspection labels.

Needed, all openly licensed (Wikimedia Commons CC, Unsplash/Pexels, or US government public domain: FEMA, HUD, EPA, NPS):

- 2 blurry photos (expected `blurry`)
- 2 non-house photos, a cat and a street (expected `not_a_house`)
- 1 normal undamaged wall (expected `normal`)
- 8-10 real defects covering every taxonomy id at least once (expected = the taxonomy id)

Record each in `test_photos.csv` with the columns `file,expected,source_url,license`, then run
`scripts\run_test_set.py`. Never add a photo whose license you have not read.
