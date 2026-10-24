from app.inference.prompts import taxonomy_ids
from app.report import mapping


def test_every_taxonomy_id_is_mapped():
    for defect in taxonomy_ids():
        assert mapping.section_for(defect)[1]


def test_known_sections():
    assert "Roof" in mapping.section_for("roof")[1]
    assert "Foundation" in mapping.section_for("foundation_structural")[1]
    assert "Electric" in mapping.section_for("electrical")[1]
    assert mapping.section_for("unclear")[1] == mapping.NEEDS_INSPECTOR


def test_grouping_follows_form_order():
    items = [{"defect_type": "pest_wood_damage"}, {"defect_type": "roof"},
             {"defect_type": "unclear"}, {"defect_type": "foundation_structural"}]
    headings = [h for h, _ in mapping.group_findings(items)]
    assert "Foundation" in headings[0] and "Roof" in headings[1]
    assert "Wood-destroying" in headings[2]
    assert headings[-1] == mapping.NEEDS_INSPECTOR
