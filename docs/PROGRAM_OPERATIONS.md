# Founding 20 — Programme Operations Playbook

**Version:** 1.0  
**Prepared:** 12 November 2026  
**Status:** Proposed operating procedure; owner approval required before recruitment.

## 1. Operating model

Founding 20 is a 12-week, free pilot for 20 selected participants. The programme lead runs one shared calendar and one operating register. Each participant has an individual development plan (IDP), one or more defined deliverables, a mentor/specialist contact where available, and a baseline/final review.

The programme should be lightweight enough for a small PMC team to operate. Use the existing website, CRM, Supabase Auth, learning content, site analytics, and owner reporting where they already fit. Do not duplicate contacts, accounts, newsletter subscriptions, or generic website analytics.

## 2. Weekly operating rhythm

| Cadence | Activity | Owner | Record |
|---|---|---|---|
| Weekly | Cohort stand-up or asynchronous update | Programme lead | Attendance/participation status and blockers |
| Weekly | Participant progress update | Participant | Completed work, next action, support request |
| Weekly | Project clinic / office hours | Mentor or specialist | Session held, agreed action, optional feedback |
| Weekly | Review of overdue tasks and at-risk participants | Programme lead | Risk flag and recovery plan |
| Fortnightly | IDP and milestone review | Participant + programme lead | Updated milestone and rationale |
| Monthly | Impact and privacy review | Programme lead + data steward | Dashboard definitions, missingness, access check |
| Week 6 | Midpoint assessment | Reviewer / mentor | Baseline-to-midpoint comparison |
| Week 12 | Final panel and graduation decision | Independent reviewers | Evidence-based decision |
| +30/+90/+180 days | Outcome follow-up | Programme lead | Verified / self-reported / unknown outcome |

Use consistent dates and event codes. Do not treat an opened page, read receipt, or uncompleted form as a meaningful learning outcome.

## 3. End-to-end workflow

### 3.1 Prepare to recruit

The owner approves the programme brief, dates, eligibility, rubric, privacy notice, data transfer route, programme lead, delivery capacity, mentor capacity, and reporting plan. The programme lead creates an application and review calendar and confirms that every application can be securely saved and withdrawn.

Recruitment may not start until the privacy and technical launch gates in PRIVACY_ARCHITECTURE.md are satisfied.

### 3.2 Receive and screen applications

1. Candidate arrives from an approved source.
2. Consent-aware discovery analytics records only allowed, non-content events.
3. The candidate reads the programme notice and submits the application.
4. The existing CRM stores contact information and consent. A programme application record references that CRM record; do not copy name/email into analytics tables.
5. The system confirms receipt and explains the review timeline.
6. An authorized screener checks completeness and the eligibility gate.
7. Applications that need clarification are marked pending; incomplete or ineligible applications receive a respectful close-out message.

No application should be silently treated as submitted if the backend save fails.

### 3.3 Assess and select

- Assign a reference to each application.
- Hide identity from reviewers where practical.
- Have two reviewers score independently against the approved 100-point rubric.
- Record criterion-level scores and evidence, not a free-form personal impression.
- Reconcile significant scoring differences and conflicts of interest.
- Approve the top 20 candidates who meet the quality bar; preserve the decision record and an optional reserve list.
- Send individual outcomes. Do not expose the other candidates or scores.
- Provide a correction/appeal route for factual errors, not a promise to reverse a merit-based decision.

### 3.4 Activate selected participants

Before the first learning session:
- Confirm acceptance of the free place and the code of conduct.
- Explain what is measured, what is optional, what is visible to mentors, and how to withdraw.
- Create the pseudonymous participant reference and restricted identity link.
- Complete the baseline rubric and IDP.
- Agree the participant's primary deliverable and review dates.
- Assign a mentor or specialist if available.
- Record activation only after onboarding, baseline, and IDP are complete.

### 3.5 Deliver and support

Each week:
- Publish a clear objective and expected output.
- Offer a learning resource, tool, or specialist session relevant to that objective.
- Ask participants to submit evidence of work, not just completion ticks.
- Review milestones and unblock participants.
- Keep mentor notes limited to agreed actions and progress. Avoid private personal narratives and sensitive details.
- Escalate inactivity, overload, conflict, accessibility needs, or risk early.
- Allow a participant to pause or withdraw without public embarrassment.

### 3.6 Assess and graduate

At midpoint, compare the same competencies used at baseline. At week 12, a reviewer checks project acceptance, competency progress, professional evidence, next-step plan, and conduct.

The panel records one of:
- Graduated.
- Completed but not yet meeting the graduation standard.
- Withdrew.
- Did not complete.

Graduation cannot be awarded from attendance alone. Employment is not a graduation condition. Record opportunities and actual outcomes separately for follow-up reporting.

### 3.7 Follow up

At 30, 90, and 180 days, invite participants to share progress and outcome status. Ask only the agreed fields and allow “prefer not to say”. Record no response as unknown. Request evidence only when needed to verify a specific outcome; allow redaction.

## 4. Templates

### 4.1 Individual Development Plan

| Field | Entry |
|---|---|
| Participant reference | Pseudonymous programme ID |
| Baseline date | Date |
| Primary professional objective | One clear objective |
| Supporting objectives | Up to two |
| Baseline competencies | 3–5 ratings using the approved rubric |
| Evidence already available | Private evidence references |
| Main development gap | Plain-language summary |
| Planned deliverables | Output, owner, target date, acceptance criteria |
| Mentor/specialist | Assigned person or “not assigned” |
| Opportunity path | Role, project, research, business, or progression pathway |
| Review dates | Weekly, midpoint, final |
| Participant acknowledgement | Timestamp |

### 4.2 Weekly participant update

- What did I complete?
- What evidence can I link or submit?
- What changed in my understanding or ability?
- What is the next action and due date?
- What support or decision do I need?
- Is there anything I do not want recorded in the programme system?

The final prompt is for safe communication and should not invite sensitive disclosures in analytics. Handle any sensitive issue through a separate authorized support channel.

### 4.3 Project acceptance record

- Project reference and participant reference.
- Original brief and success criteria.
- Deliverable received date.
- Participant contribution.
- Reviewer and review date.
- Quality ratings: problem, execution, evidence, communication, usefulness.
- Accepted / revision required / not accepted.
- Evidence reference and short rationale.

### 4.4 Outcome record

- Participant reference.
- Outcome type: opportunity shared, applied, interview, offer, paid project, work started, promotion, role transition, further learning.
- Event date and follow-up date.
- Status: self-reported, participant-documented, independently verified, not verified, unknown.
- Evidence reference if supplied.
- Consent basis for any external confirmation.
- No salary, private correspondence, or employer contact information in general analytics.

## 5. Risk and escalation management

| Risk | Early signal | Response |
|---|---|---|
| Low participation | Repeated missed milestones or no response | Private check-in, identify barriers, adjust plan |
| Mentor capacity gap | Sessions repeatedly cancelled | Reassign, use group clinic, or reduce promised scope |
| Unequal access | Participant lacks device, connectivity, or formal portfolio | Offer accessible formats and alternative work evidence |
| Project scope creep | Deliverable no longer fits time/capacity | Re-scope with written acceptance criteria |
| Conflict of interest | Reviewer/mentor has personal or employer relationship | Declare, reassign reviewer, record action |
| Misreported outcomes | Evidence conflicts with claim | Reclassify as unverified; do not publish |
| Privacy or security incident | Unintended disclosure, wrong access, lost device, suspicious export | Stop further sharing, preserve logs, notify the designated privacy/security owner |
| Partner pressure | Partner asks to influence selection or receive participant data | Decline; refer to owner; require participant-specific consent and agreement |

## 6. Operating register and dashboard inputs

The programme lead should maintain only structured fields needed for the dashboard:

- Cohort and application reference.
- Eligibility and selection state.
- Participant reference and lifecycle state.
- IDP dates and milestone codes.
- Activity and engagement events.
- Tool code and event count.
- Learning activity code and completion evidence state.
- Project and review state.
- Baseline/midpoint/final competency values.
- CV and LinkedIn rubric values.
- Opportunity and outcome state with verification level.
- Satisfaction response at approved checkpoints.
- Follow-up status and measurement coverage.

Do not use personal notes as a substitute for structured metrics. Do not store full CV text, mentor conversation, private message, passwords, or sensitive personal narrative in event metadata.

## 7. Decision log and change control

Important decisions must be recorded with date, owner, reason, affected documents, and whether participant communication is required. Any change to selection weights, graduation criteria, CVI weights, consent, retention, or data recipients requires owner approval and must be applied prospectively. Do not change the measurement method mid-cohort without documenting the version and impact on comparability.

## 8. Pilot close-out

Within two weeks of week 12, the programme lead prepares:
- Cohort funnel and retention.
- Completion and graduation outcomes.
- Skills and professional-evidence improvements.
- Projects delivered and quality review.
- Opportunity outcomes with verification labels.
- Satisfaction and qualitative themes with identity removed.
- Volunteer/specialist time and actual costs.
- Privacy, delivery, and data-quality incidents.
- Lessons and recommendations for the next cohort.

The 90- and 180-day reports append outcomes later. The initial close-out must label those outcome windows as pending, not assume success or failure.
