"""Tests for the care gap rules engine."""

from datetime import date, timedelta

from app.services.summary_service import _run_care_gap_rules


def _base_aggregate():
    return {
        "patient_id": "test-patient",
        "problems": [],
        "medications": [],
        "allergies": [],
        "vitals": [],
        "labs": [],
        "visit_history": [],
        "immunizations": [],
    }


class TestHbA1cRule:
    def test_diabetic_with_no_labs_triggers_gap(self):
        agg = _base_aggregate()
        agg["problems"] = [{"code": "Type 2 Diabetes Mellitus"}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "HbA1c overdue" in labels

    def test_diabetic_with_recent_hba1c_no_gap(self):
        agg = _base_aggregate()
        agg["problems"] = [{"code": "Type 2 Diabetes Mellitus"}]
        recent = (date.today() - timedelta(days=30)).isoformat()
        agg["labs"] = [{"code": "HbA1c", "value": 7.1, "unit": "%", "date": recent, "interpretation": ""}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "HbA1c overdue" not in labels

    def test_diabetic_with_stale_hba1c_triggers_gap(self):
        agg = _base_aggregate()
        agg["problems"] = [{"code": "Type 2 Diabetes Mellitus"}]
        stale = (date.today() - timedelta(days=120)).isoformat()
        agg["labs"] = [{"code": "HbA1c", "value": 7.5, "unit": "%", "date": stale, "interpretation": ""}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "HbA1c overdue" in labels

    def test_non_diabetic_no_gap(self):
        agg = _base_aggregate()
        agg["problems"] = [{"code": "Hypertension"}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "HbA1c overdue" not in labels


class TestFluVaccineRule:
    def test_no_flu_vaccine_triggers_gap(self):
        agg = _base_aggregate()
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "Annual flu vaccine missing" in labels

    def test_recent_flu_vaccine_no_gap(self):
        agg = _base_aggregate()
        recent = (date.today() - timedelta(days=60)).isoformat()
        agg["immunizations"] = [{"vaccine": "Influenza vaccine", "date": recent, "status": "completed"}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "Annual flu vaccine missing" not in labels


class TestElevatedBpRule:
    def test_elevated_bp_no_follow_up_triggers_gap(self):
        agg = _base_aggregate()
        agg["vitals"] = [{"code": "Systolic blood pressure", "value": 155, "unit": "mmHg", "date": date.today().isoformat()}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "Elevated BP — no recent follow-up" in labels

    def test_elevated_bp_with_recent_encounter_no_gap(self):
        agg = _base_aggregate()
        agg["vitals"] = [{"code": "Systolic blood pressure", "value": 155, "unit": "mmHg", "date": date.today().isoformat()}]
        recent_encounter = (date.today() - timedelta(days=10)).isoformat()
        agg["visit_history"] = [{"date": recent_encounter, "type": "Office visit", "status": "finished", "reason": ""}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "Elevated BP — no recent follow-up" not in labels

    def test_normal_bp_no_gap(self):
        agg = _base_aggregate()
        agg["vitals"] = [{"code": "Systolic blood pressure", "value": 118, "unit": "mmHg", "date": date.today().isoformat()}]
        gaps = _run_care_gap_rules(agg)
        labels = [g["label"] for g in gaps]
        assert "Elevated BP — no recent follow-up" not in labels
