# Gate 0 photo attribution

License pages and source descriptions checked on October 24, 2026. Both repository
images were visually inspected. Each was resized to 1024 × 768, re-encoded as JPEG,
and stripped of EXIF using `app.images.sanitize`. No crop or generated content was
added. These image adaptations retain the respective source image licenses;
the repository's code license does not replace them. No endorsement is implied.

## gate0_water_stain.jpg

- Original title: **Water Damage.JPG**.
- Photographer: **Ed!**, August 1, 2009.
- Source: [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Water_Damage.JPG).
- Original: [Water_Damage.JPG](https://upload.wikimedia.org/wikipedia/commons/7/71/Water_Damage.JPG).
- Selected license: [Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
- Visible evidence: a small irregular tan/discolored patch with peeling surface at
  the edge of a textured ceiling, just above the wall/ceiling junction.
- Expected taxonomy: `water_intrusion`. The source identifies water damage;
  the photo alone does not establish an active leak or its cause.

## gate0_chimney_spalling.jpg

- Original title: **Spalling in chimney.jpg**.
- Photographer: **Beltedweir**, July 11, 2017.
- Source: [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Spalling_in_chimney.jpg).
- Original: [Spalling_in_chimney.jpg](https://upload.wikimedia.org/wikipedia/commons/b/bd/Spalling_in_chimney.jpg).
- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- Visible evidence: an attic brick chimney between wooden roof members, with
  flaked/eroded brick faces, cavities and brick debris along its base.
- Expected taxonomy: `chimney_fireplace`. (Taxonomy v1 had no chimney category, so
  this was `foundation_structural`; that label did not establish structural instability.)

Gate 0 image specificity requires different descriptions of these visible features.
A generic statement such as “there may be home damage” fails. Correct taxonomy JSON
alone does not prove that the model saw either image.
