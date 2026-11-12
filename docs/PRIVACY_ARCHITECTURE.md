# Founding 20 — Privacy and Data Architecture

**Version:** 1.0  
**Prepared:** 12 November 2026  
**Status:** Design and control requirements; not a legal opinion or evidence of completed compliance certification.

## 1. Privacy-by-design objective

Founding 20 must be measurable without turning participant development into intrusive surveillance. Collect only what is needed to select, support, assess, and report the programme. Use pseudonymous participant references for analytics and separate those records from identity and contact information.

Pseudonymisation is not anonymisation. A participant reference remains personal data if PMC can reconnect it to a person through separately held information. SDAIA's implementing regulation describes pseudonymisation as replacing direct identifiers with codes while keeping the additional identity information separately under appropriate controls. See the official [Saudi PDPL knowledge centre](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/).

## 2. Existing infrastructure inspected

The live PMC project already provides a useful foundation:

- Supabase Auth and profiles hold account identity and professional profile information.
- The CRM has an onboarding_leads table with applicant/contact fields such as name, email, user type, specialty, goal, consent, source path, status, and optional conversion to a user account.
- onboarding_interest_events records interest against a lead.
- site_analytics_events records consent-aware website events using a visitor identifier, with optional signed-in user association, page, source/referrer/campaign, timezone, locale, device, browser, and viewport category.
- newsletter_subscribers stores email subscription and consent data.
- public_experience_surveys and community_feedback provide visitor/member feedback.
- The owner analytics page reads restricted RPCs for analytics, devices, leads, survey summaries, and behavioural insights; it includes separate CSV exports and a consolidated owner-only CRM JSON export.
- The site analytics code checks the visitor's analytics choice before recording events. It does not require or justify tracking every person.
- The database has RLS enabled on the inspected public tables. The security advisor also reports tables with RLS enabled but no direct policies; this is a deny-by-default/server-side pattern that must be reviewed table by table, not widened with public policies.
- The onboarding Edge Function validates consent and has a server-side collection flag. The current repository also contains a waitlist component, but the Founding 20 application route and its production readiness are not yet proven. Do not assume the application is open.

**Current data-location finding:** Supabase project metadata reports the active PMC project region as Singapore (AWS ap-southeast-1). The primary database, Auth, and Storage are hosted in the selected project region according to Supabase's data residency documentation. This is a cross-border processing issue for Saudi-resident applicants and participants that must be assessed before collecting Founding 20 application, identity, CV, or outcome data.

Supabase describes encryption at rest using AES-256 and encryption in transit via TLS. Supabase project APIs accept HTTPS using TLS 1.2 or TLS 1.3. These are provider controls, not proof that PMC's own access configuration, backup policy, database SSL enforcement, transfer basis, or legal obligations have been completed. Verify the actual project configuration and contractual terms before launch.

Sources:
- [SDAIA — PDPL and implementing regulations](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/)
- [SDAIA — Regulation on Personal Data Transfer outside the Kingdom](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/RegulationonPersonalDataTransferOutsidetheKingdom/)
- [Supabase — Data Residency and Transfers FAQ, version 1, 6 October 2026](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
- [Supabase — Security at Supabase](https://supabase.com/security)
- [Supabase — Secure configuration of the platform](https://supabase.com/docs/guides/security/platform-security)
- [Supabase — TLS for project APIs](https://supabase.com/docs/guides/security/tls)

## 3. Proposed logical data separation

Do not duplicate existing identity and CRM systems. Reuse the existing lead and member identity source, and add programme-specific records only when the programme workflow is approved.

| Logical store | Purpose | Personal identifiers allowed? | Access |
|---|---|---|---|
| Existing CRM lead record | Contact details, consent, source attribution, lead status | Yes, minimum required | Restricted owner/authorized programme operations |
| Programme application record | Eligibility, rubric scores, decision, cohort reference, lead reference | No duplicate name/email; use application reference and lead reference | Selection panel and programme lead, scoped |
| Participant identity link | Link participant reference to existing lead/auth user | Link identifiers only; no duplicate contact fields | Owner and specifically authorized identity operator |
| Participant analytics/events | Activity, tools, learning, project and engagement events | Pseudonymous participant reference only | Programme analytics and approved service functions |
| Participant measurements | Baseline/final rubric values, CVI dimensions, evidence state | Pseudonymous participant reference only | Programme lead and authorized reviewer |
| Private evidence storage | CVs, work samples, project artifacts, consent evidence when necessary | May contain personal data | Named authorized reviewers only |
| Aggregate reporting | Funnel, programme outcomes, CVI distributions | No direct identifiers | PMC leadership; approved aggregate partner reporting |

### 3.1 Minimal future schema proposal

The proposed programme data model is deliberately small:

- Cohorts: cohort code, programme dates, approved capacity, status, and versioned rubric reference.
- Applications: application reference, cohort reference, existing CRM lead reference, eligibility result, structured selection scores, reviewer decisions, and timestamps.
- Participants: random participant reference, cohort reference, application reference, lifecycle status, activation and completion timestamps.
- Identity links: participant reference mapped to an existing lead and, after account creation, the existing Auth user ID. Keep this mapping separate and owner-restricted.
- Participant events: participant reference, allow-listed event code, timestamp, source system, and optional private evidence reference.
- Participant measurements: participant reference, metric code, baseline/final value, measurement date, evidence state, and assessor reference.

Do not store names, emails, phone numbers, CV text, free-text mentor notes, or employer correspondence in the participant event or measurement tables. Avoid open-ended JSON metadata for analytics. Define allowed event and metric codes. Store only the private evidence reference in the analytical record.

This model is a design recommendation, not a deployed migration. The first implementation should reuse onboarding_leads for the contact record and must not create duplicate contact tables. Add programme-specific tables only after approval of the application workflow, identity mapping, roles, and data-location decision.

## 4. Data flow

1. **Discovery:** consent-aware site analytics may record a visitor reference and source attribution. No identity is inferred from device or IP data.
2. **Application:** the applicant receives a clear notice and submits the minimum details. The existing CRM lead record is the contact source of truth. A separate programme application record references the lead.
3. **Selection:** the panel reviews structured evidence and scores. Where practical, reviewers receive an application reference rather than contact details.
4. **Selection outcome:** only accepted participants are assigned a random participant reference. A separate identity link associates it with the lead and later an Auth account.
5. **Programme activity:** approved tools and learning systems record allowed programme event codes against the participant reference.
6. **Assessment:** baseline, midpoint, final, and follow-up measurements are recorded against the participant reference. Evidence stays in private storage.
7. **Reporting:** the dashboard receives pseudonymous participant-level metrics or aggregated data. Identity is not required for CVI calculation.
8. **Opportunity sharing:** participant identity or portfolio material is sent to an employer or institution only after specific participant opt-in for that introduction or disclosure.

## 5. Role-based access model

Use existing authenticated roles where appropriate, but do not assume every manager, coach, or mentor should see every participant record. Programme-specific assignments should scope access.

| Role | Permitted view | Not permitted |
|---|---|---|
| Platform owner | Full programme governance and identity mapping where necessary; exports; access audit | Unlogged bulk sharing or unrelated use |
| Programme lead | Assigned cohort operations, applications needed for decisions, IDPs, milestones | General service-role credentials or unrestricted technical secrets |
| Selection reviewer | Assigned application packet and scoring fields | Bulk CRM, contact exports, unrelated participant records |
| Mentor / specialist | Only assigned participants and agreed progress artifacts | Identity map, selection notes, other mentors' participants, bulk export |
| Impact analyst / AI agent | Pseudonymous records and aggregates | Names, emails, phone numbers, raw CVs, private messages, identity mapping, keys |
| Employer / partner | Only the material a participant explicitly agreed to share | Cohort roster or participant data by default |
| Participant | Own IDP, own programme activity, own evidence and correction/withdrawal route | Another participant's records |

Prefer server-side Edge Functions or narrowly guarded RPCs for programme operations. Keep RLS enabled. New tables should deny direct anonymous access and direct client writes by default. Every privileged function must validate the authenticated actor and programme assignment inside the function; hiding a button in the UI is not authorization.

Do not grant broad authenticated execution to identity-export or decryption functions. Review every SECURITY DEFINER function individually, use a fixed search_path, validate ownership/assignment, and test both allowed and denied cases. Keep audit logs for selection decisions, identity reveals, exports, evidence access, and role changes.

## 6. Encryption, keys, and service boundaries

- Use Supabase's provider-managed encryption at rest and HTTPS/TLS in transit as the baseline, and verify the current service configuration and DPA.
- Confirm database SSL enforcement for direct PostgreSQL and pooler connections separately; Supabase documentation notes that HTTP APIs enforce HTTPS while Postgres SSL enforcement is a separate setting.
- Keep service-role keys, JWT signing secrets, storage credentials, and any encryption keys in the provider's secret manager, not in GitHub, client-side VITE variables, documents, issues, or AI prompts.
- If additional field-level encryption is required by the approved risk assessment, use a vetted managed KMS / envelope-encryption service with key rotation, access logging, recovery, and separation of duties. Do not invent a cipher, hand-roll key management, or store a decryption key beside ciphertext.
- Only a narrowly authorized server-side service may decrypt fields that require application-level protection. Most impact analysis should not require decryption.
- Never send keys, raw identity mapping, CV files, or unredacted applications to an AI agent. AI analysis should use pseudonymous measures or sufficiently aggregated data.

## 7. Saudi PDPL and cross-border assessment gate

The current project is in Singapore. Do not assume that encryption or a vendor's general security certifications automatically resolve Saudi data-transfer requirements.

Before collecting Founding 20 personal data, PMC's data controller must document:

1. The processing purposes and legal basis for each data category.
2. The categories of data subjects and data, including applicants, selected participants, mentors, and staff.
3. The geographic locations of the database, Auth, Storage, backups, support access, telemetry, CDN, and subprocessors.
4. The relevant Supabase DPA, subprocessor list, and contractual safeguards.
5. Whether a transfer mechanism, approved standard contractual clauses, other appropriate safeguards, or an applicable permitted case is required.
6. A risk assessment where required by the Saudi transfer regulation, including purpose/legal basis, data and geography, safeguards, minimization, potential impact, and mitigation.
7. Whether a KSA-hosted deployment or a reduced-data design is more appropriate before launch.

SDAIA's transfer regulation allows transfers subject to its conditions, including purpose, minimization, protection of data-subject rights, and appropriate safeguards. It identifies specific risk-assessment cases and assessment elements. This document does not conclude that the current Singapore project is compliant or non-compliant; the responsible controller and qualified Saudi privacy counsel must decide the applicable route.

## 8. Consent, transparency, and data-subject handling

Use separate, clear choices for:
- Processing needed to evaluate and operate the programme.
- Optional marketing and newsletter communications.
- Optional public story, testimonial, participant spotlight, or project showcase.
- Optional sharing with a named employer, university, mentor, or partner.

No marketing consent is a condition of programme application or participation. Public display of a website profile is not permission to publish programme status, selection scores, project evidence, or outcomes.

Provide a clear route to access, correct, withdraw, and request deletion where applicable. Explain any limited retention or legal reason that prevents immediate deletion. Record the notice version and consent timestamp.

## 9. Retention and deletion proposal

The following are proposed programme defaults for owner/legal approval, not statutory retention periods:

- Unsuccessful applicants: delete or de-identify the identifiable application and reviewer material within 90 days after the final decision, unless the applicant separately opts into a defined talent pool.
- Selected participant identity link and contact record: retain only through delivery and the 180-day follow-up, then review and delete or de-identify within a further 12 months unless a documented purpose or legal requirement justifies retention.
- Pseudonymous programme metrics: retain as long as needed for the approved impact evaluation; aggregate or anonymize when individual-level follow-up is no longer needed.
- Private evidence: delete when review, appeal, follow-up, and agreed portfolio use are complete, subject to the approved retention notice.
- Consent and access audit records: retain for a documented, approved period sufficient to demonstrate accountability.

A deletion request must be propagated to the relevant CRM, programme mapping, storage, analytics, and backup lifecycle according to the approved legal process. Do not promise immediate removal from immutable backups where the provider's backup lifecycle does not support it; explain the actual process.

## 10. Security acceptance checklist

Before first application:
- [ ] Data map and lawful basis approved.
- [ ] Singapore transfer assessment and contractual safeguards reviewed; KSA hosting decision documented.
- [ ] Privacy notice and separate consent choices approved.
- [ ] Private evidence bucket and file-type/size controls approved.
- [ ] New programme tables, if any, have RLS and least-privilege grants.
- [ ] Identity mapping is isolated and owner-restricted.
- [ ] RPC and Edge Function authorization tests cover unauthorized, wrong-cohort, and wrong-assignment requests.
- [ ] Secrets are stored server-side; no keys in source or AI context.
- [ ] Audit trail covers identity reveals and exports.
- [ ] Retention, withdrawal, correction, and deletion procedures are tested.
- [ ] AI/analytics export contains pseudonymous or aggregated records only.
