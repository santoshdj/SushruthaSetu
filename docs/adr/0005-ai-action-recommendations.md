# ADR 0005: AI Action Recommendations from Visit Conversations

**Date:** 2026-05-20
**Status:** Accepted
**Deciders:** Product owner (via design interview, 2026-05-20)
**Extends:** ADR-0004 (Visit Notes), ADR-0001 (dashboard sections)

---

## Context

The Patient Dashboard already generates a Pre-Visit Summary from FHIR data before the encounter starts. A new AI feature generates **Action Recommendations** — categorised clinical next steps (medications, lab tests, referrals, follow-ups, patient education) derived from the conversation captured in the Current Visit Note. This feature operates during or after the visit, not before it.

All decisions were made during a structured design interview on 2026-05-20.

---

## Decisions

### 1. Trigger: on-demand button

**Decision:** Action Recommendations are generated when the clinician explicitly clicks "✨ Suggest next steps" inside the Visit Note panel. No automatic triggering on save or on keystroke.

**Rationale:** Clinicians control when they want suggestions. Auto-triggering on save couples a write operation to an AI call and adds latency. Live debounced triggering is noisy and expensive. An explicit button is deliberate and transparent.

---

### 2. AI input: visit note + patient aggregate + previous visit notes (longitudinal)

**Decision:** The Action Recommendations engine receives three inputs:
1. The current Visit Note text (from the textarea at time of button click)
2. The full patient aggregate: problems, medications, allergies, vitals, labs, care gaps
3. The 5 most recent Previous Visit Notes (Clinical Notes and Visit Notes), for longitudinal context

**Rationale:** The aggregate prevents suggesting things the patient already receives (e.g. "start metformin" when metformin is already in the medication list). Previous notes provide longitudinal context — recurring symptoms, evolving diagnoses, previously attempted treatments — enabling more clinically relevant suggestions. Note-only input (without aggregate) was rejected as clinically unsafe. Previous notes without a count cap was rejected to control token cost.

---

### 3. Output: categorised suggestions with urgency

**Decision:** The AI returns a JSON array of objects with this shape:
```json
{ "category": "Lab Tests", "action": "Order HbA1c", "urgency": "routine", "rationale": "Last HbA1c 4 months ago; patient is diabetic" }
```

Valid categories: `Medications`, `Lab Tests`, `Referrals`, `Follow-up`, `Patient Education`
Valid urgency values: `routine`, `urgent`, `critical`

**Rationale:** Categories let the clinician scan by action type. Urgency enables triage. A flat list was rejected as losing scannability. Prose narrative was rejected as harder to act on. The structured shape also enables future "one-click order" enhancements per suggestion.

---

### 4. Placement: dedicated card on the Patient Dashboard

**Decision:** An "AI Action Recommendations" `CollapsibleCard` is added to the Patient Dashboard, positioned just below the Pre-Visit Summary card. It starts empty. When the clinician requests suggestions, it shows a loading state, then renders the categorised results grouped by category with urgency badges.

**Rationale:** A dashboard card keeps suggestions visible alongside the clinical data the clinician is cross-referencing. The sticky Visit Note panel (Option A) already has a defined role and should not grow further. A modal (Option C) loses dashboard context.

---

### 5. API: dedicated `POST /patients/{id}/action-recommendations`

**Decision:** A new endpoint `POST /patients/{id}/action-recommendations` accepts `{ note_text: string }` in the body. The backend fetches the patient aggregate and the 5 most recent notes internally, then calls Claude. Returns `{ recommendations: [{category, action, urgency, rationale}] }`.

**Rationale:** The pre-visit summary is fetched on page load with no input. Action Recommendations are fetched on demand with note text as input. These are different lifecycles — merging them into one endpoint would force the pre-visit summary to wait for note text that doesn't exist at page load time. `POST` is correct because the note text is a meaningful input body.

---

## Consequences

- `POST /patients/{patient_id}/action-recommendations` added to `summary.py` router.
- `action_recommendations_service.py` created — builds prompt from note + aggregate + notes, calls Claude, parses JSON.
- `ActionRecommendationsCard` component added — renders suggestions grouped by category with urgency badges.
- `VisitNotePanel` gets "✨ Suggest next steps" button and `onSuggestNextSteps` callback prop.
- `PatientDashboardPage` owns the recommendations state and wires the panel callback to the card.
