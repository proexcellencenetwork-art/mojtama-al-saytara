# Founding 20 — Impact Measurement Framework

**Version:** 1.0  
**Prepared:** 12 November 2026  
**Status:** Proposed framework; approve the rubric before the first baseline is collected.  
**Purpose:** A repeatable, evidence-based measurement model for the first 20-person PMC cohort.

## 1. Measurement principles

- Measure participant progress, not just programme activity.
- Define each metric before collection; do not change denominators after seeing results.
- Keep programme activity, participant-reported outcomes, documented outcomes, and independently verified outcomes separate.
- Use a baseline and a comparable final measure wherever possible.
- Never convert estimates, intentions, referrals, or job links into confirmed interviews or employment.
- Report all 20 selected participants in cohort-level funnel and retention denominators. Explain withdrawals and missing measures; do not silently remove them.
- Use pseudonymous participant references for analytics. Identity and contact records remain in the restricted identity layer.
- Capture only the minimum information needed. Tool tracking is an operational measure, not a proxy for professional value.

## 2. Participant journey and stage definitions

The measurement funnel follows:

**Discovery → Application → Selection → Activation → Engagement → Development → Outcomes → Follow-up**

| Stage | Operational definition | Required timestamp or evidence |
|---|---|---|
| Discovery | A candidate reaches a PMC Founding 20 information or application page, or is referred through an identified channel | Page event or referral source; consent-aware analytics only |
| Application | A complete application is successfully saved | Application ID and submitted_at |
| Eligible | Eligibility gate passed after review | Reviewer decision and date |
| Selected | Formal selection decision recorded | Decision status and decision date |
| Activated | Selected participant accepts the place, completes onboarding, baseline, and IDP | Accepted_at, baseline_complete, IDP_complete |
| Active | Participant completes at least one meaningful programme action in the last 14 days during delivery | Qualifying event, not page views alone |
| Engaged | Participant takes part in agreed learning, project, mentor, or peer activity | Structured engagement events |
| Developed | Comparable baseline and final evidence show competency or artifact progress | Rubric and evidence references |
| Graduated | Graduation panel confirms the requirements in FOUNDING_20_PROGRAM.md | Panel decision and evidence references |
| Outcome | Interview, offer, project, placement, or employment event has been reported and assigned a verification status | Outcome record and evidence/verification state |
| Long-term impact | A 90- or 180-day follow-up confirms sustained progress | Follow-up date and evidence category |

Applications received, eligible applications, selections, activated participants, and graduates are different counts and must never be used interchangeably.

## 3. Metric catalogue

### A. Activity metrics

Activity shows what the programme delivered and what participants attempted. It does not prove learning.

| Metric | Definition | Source / capture rule |
|---|---|---|
| Applications received | Count of successfully submitted, deduplicated applications | Application record |
| Eligible applications | Applications passing the eligibility gate | Reviewer decision |
| Candidates selected | Formal offers of a cohort place | Selection record |
| Active participants | Activated participants with a meaningful action in the last 14 days | Programme event log |
| Tools used | Distinct approved tool identifiers used by a participant | Tool-start or tool-complete event |
| Tool usage frequency | Count of starts and completions by participant and tool in a reporting period | Event log; do not collect form contents |
| Learning activities completed | Activities with completion evidence, not merely opened | Learning record or reviewed artifact |
| Mentor sessions held | Sessions completed, not only booked | Mentor engagement record |
| Assignments submitted | Assignments received by the stated deadline or approved extension | Assignment milestone record |

Recommended reporting: total, unique participants, per-participant median, and distribution. Page views alone are not meaningful programme activity.

### B. Engagement metrics

Engagement measures sustained and purposeful participation.

- Two-week active-participant rate = active participants in the period ÷ activated participants.
- Learning engagement rate = participants completing at least one agreed learning activity in the period ÷ activated participants.
- Mentor engagement rate = participants completing at least one mentor/specialist session ÷ participants assigned a mentor.
- Project continuity = participants with a valid project milestone in the period ÷ participants with a project plan.
- Retention = participants still participating at week N ÷ activated participants.

Publish the denominator and period. Do not use public profile views or raw social reactions as evidence of engagement quality.

### C. Development metrics

Development measures whether capability and professional evidence improved.

| Metric | Method | Evidence standard |
|---|---|---|
| Skills developed | Baseline and final competency ratings using the same 1–4 anchored rubric | Self-rating plus reviewer/mentor assessment; disagreements noted |
| Projects delivered | Count of deliverables accepted against an agreed brief | Project artifact and reviewer acceptance |
| Project quality | Rubric across problem definition, execution, evidence, communication, and usefulness | Reviewer score with short rationale |
| CV improvement | Before/after review against a consistent rubric | Participant-approved copies or reviewer checklist |
| LinkedIn improvement | Before/after review of headline, positioning, evidence, experience, and clarity | Participant-approved review; no scraping or password collection |
| Portfolio readiness | Presence and quality of relevant evidence artifacts | Reviewed portfolio or case study |
| Professional confidence | Optional pre/post participant-reported measure | Label as self-reported, not objective skill proof |

Use the same rubric and scale at baseline and final assessment. A workshop attendance record is not a skill result.

### D. Outcome metrics

Separate access to opportunity from realised results.

| Measure | Count only when | Classification |
|---|---|---|
| Opportunity surfaced | A relevant, dated opportunity is identified | Activity / opportunity access |
| Opportunity shared | The opportunity is sent to the participant | Engagement |
| Application submitted | Participant confirms applying | Participant-reported unless documented |
| Interview opportunity | The participant confirms receiving an interview invitation; record evidence state | Report as self-reported, documented, or independently verified |
| Offer received | A formal offer or project proposal is received | Report with verification state |
| Employment outcome | Participant starts paid employment or another defined paid work arrangement | Confirmed only with suitable evidence or independent confirmation |
| Promotion / role transition | A real change in role or responsibility occurs | Confirmed only with suitable evidence |
| Paid project / contract | Work is agreed and started or delivered, according to the declared metric | Distinguish contract signed from work started |

Never report a job link as an application, an application as an interview, an interview as an offer, or an offer as a job start. Do not require a participant to disclose salary. If salary change is voluntarily reported, keep it restricted and aggregate only when appropriate.

### E. Long-term impact metrics

Collect at 30, 90, and 180 days after programme end, with the 90- and 180-day checkpoints as the principal follow-up windows.

- Employment or work status at follow-up.
- Whether the participant is still using the project or skills developed.
- Continued education, professional certification, promotion, role change, or new paid project.
- New interviews or opportunities since the last checkpoint.
- Self-reported usefulness and satisfaction.
- Whether the participant is contributing back as a mentor, speaker, referrer, or volunteer.

A follow-up not received is **unknown**, not “no outcome”. A self-reported outcome must remain labelled as such.

## 4. Evidence and verification levels

Use a consistent evidence status on every outcome:

1. **Self-reported:** participant says the event occurred; no evidence reviewed.
2. **Participant-documented:** participant provides a redacted artifact or suitable record.
3. **Independently verified:** an authorized reviewer checks evidence or an appropriate third party confirms the event.
4. **Not verified / disputed:** evidence is missing, contradictory, or cannot be relied on.
5. **Not applicable / not yet due:** the measure is not expected at this point.

Keep evidence in a private storage location with access controls. Store only an evidence reference and verification state in analytical records. Redact unnecessary personal data before review. No employment claim is confirmed merely because a participant's public profile changed.

## 5. Community Value Index (CVI)

The Community Value Index is an internal, transparent score for programme value. It is a management instrument, not an externally validated qualification and not a ranking of human worth.

### 5.1 Proposed weights

| Dimension | Weight | What it represents |
|---|---:|---|
| A. Activity | 10% | Completion of agreed actions and practical attempts |
| B. Engagement | 15% | Sustained learning, mentor, and project engagement |
| C. Development | 30% | Demonstrated competency and professional-evidence improvement |
| D. Outcomes | 30% | Verified access to opportunities and realised professional outcomes |
| E. Long-term impact | 15% | Sustained progress at 90/180 days |
| **Total** | **100%** | |

### 5.2 Formula

Each dimension is scored from 0 to 100 using published, pre-agreed sub-rubrics. For participant i:

**CVIᵢ = 0.10Aᵢ + 0.15Bᵢ + 0.30Cᵢ + 0.30Dᵢ + 0.15Eᵢ**

A dimension that has not yet become measurable is **N/A**, not zero. For a provisional CVI, calculate the weighted mean only across dimensions that are due and have valid data:

**Provisional CVIᵢ = sum(weight × dimension score for due, measured dimensions) ÷ sum(weights for due, measured dimensions)**

Always display **measurement coverage** beside the provisional score: the sum of weights for due dimensions with valid data. Do not show a participant or cohort CVI as final until all five dimensions are due and the agreed coverage threshold is met. Proposed reporting threshold: at least 80% coverage, with the reason for every unavailable dimension shown.

### 5.3 Dimension scoring guidance

Score outcome progress against each participant's agreed goal pathway (for example, first employment, role transition, promotion, research contribution, or a paid project). Do not use one universal employment target to rank participants with different starting points. A meaningful verified outcome should be judged against the individual plan; no employment outcome is guaranteed or required for graduation.

- **A — Activity:** agreed deliverables completed ÷ agreed deliverables due, capped at 100; do not reward duplicate or low-value clicks.
- **B — Engagement:** a balanced score from meaningful learning completion, project continuity, and mentor/peer engagement. Page views alone contribute nothing.
- **C — Development:** compare baseline and final competency rubric, project acceptance, CV/LinkedIn/portfolio rubric, and ability to explain the work.
- **D — Outcomes:** score opportunity progress by stage and verification status. A documented interview or paid project is more meaningful than an opportunity link; employment starts are distinct from offers.
- **E — Long-term impact:** use follow-up evidence of sustained use, employment/work status, role progression, further learning, and contribution back to the community.

The scoring sub-rubrics and point bands must be approved before the first baseline is collected. Do not change scoring weights mid-cohort to make results appear better. Preserve the raw metrics so the index can be recalculated transparently if the rubric is later revised.

### 5.4 Cohort-level CVI

Report the arithmetic mean and median participant CVI, the score distribution, and coverage. Also report the full cohort funnel and participant count. Do not average only the highest-performing or easiest-to-measure participants. Show the number of participants with unknown or missing follow-up data. Do not compare cohorts until the same rubric, maturity window, and measurement coverage are used.

## 6. Dashboard specification

The impact dashboard should have five views:

1. **Funnel:** applications → eligible → selected → activated → active → graduated.
2. **Engagement:** activity by week, learning and tools used, mentor engagement, project milestones.
3. **Development:** baseline/final skills, project acceptance, CV/LinkedIn/portfolio rubric changes.
4. **Outcomes:** opportunities, applications, interviews, offers, work starts, and verification status.
5. **Longitudinal impact:** 30/90/180-day follow-ups, satisfaction, CVI, and measurement coverage.

All participant-level views use the pseudonymous participant reference. Identity is revealed only in the separate authorized operational view when contact is necessary. Public and sponsor reports use aggregate values and suppress small groups where re-identification is possible.

## 7. Reporting cadence

| When | Report |
|---|---|
| Before start | Cohort baseline, selection funnel, agreed indicators and rubrics |
| Weekly | Delivery, activity, engagement, risks, and missing data |
| Week 6 | Midpoint development and project review |
| Week 12 | Completion, graduation decisions, final competency and artifact assessment |
| +30 days | Early opportunity and satisfaction follow-up |
| +90 days | Outcome and continued-use follow-up |
| +180 days | Long-term impact review and pilot retrospective |

Every report should state: reporting period, numerator, denominator, definition, source, verification status, missingness, and any limitations. Keep estimates and forecasts out of confirmed-result totals.
