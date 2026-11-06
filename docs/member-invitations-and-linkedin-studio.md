# Member invitations and LinkedIn studio

## Invitation flow

- A coach, moderator, manager, or platform owner can request an invitation only through the authenticated `community-invite` Edge Function.
- Supabase Auth generates a recipient-specific confirmation URL. The raw token is never created, stored, or exposed by the browser UI.
- The redirect marker is `?flow=community-invite`; the app verifies the resulting Auth session and sends the recipient to `/reset-password?welcome=community-invite` to create an initial password.
- After the password is saved, the app opens `/pending-review?welcome=community-invite` and displays the branded welcome. Every invited account starts with the base `member` role and remains pending until its email is confirmed and the community review is completed. The invite link does not grant coach, moderator, manager, or owner access.
- `supabase/templates/community-invite.html` is the branded Arabic invite email template. `supabase/config.toml` points the local Supabase configuration at this template.

## Hosted email configuration still required

The template file and local config do not by themselves change the hosted project's Auth email settings. Before describing invitations as sent from a branded sender:

1. In Supabase Dashboard, open **Authentication → Email Templates → Invite User** and install the HTML from `supabase/templates/community-invite.html`.
2. Configure a custom SMTP provider in **Authentication → SMTP Settings**.
3. Verify the sender domain with the SMTP provider, then set a sender name such as **مجتمع السيطرة المهنية** and an address on that verified domain.
4. In **Authentication → URL Configuration**, retain the community's Pages base URL in the allowed redirect URLs.
5. Send a test invitation to an address controlled by the project owner. Verify inbox delivery, sender identity, link acceptance, and the branded welcome/pending-review page before inviting real members.

Supabase's current changelog notes a restriction on customizing Auth email templates for new Free-tier projects using default SMTP; a custom SMTP provider may be required. Do not assume that editing `config.toml` updates hosted Auth settings.

## LinkedIn studio

- Members open **الأدوات المهنية → استوديو الحضور المهني**.
- The studio creates a 1200×1200 square or 1200×1500 portrait PNG with the community's teal/gold visual identity, editable heading, supporting line, and member signature.
- Members can copy their own post text and open LinkedIn's composer; the studio does not post on their behalf and does not request LinkedIn credentials or permissions.
- The design is community-branded, not a LinkedIn verification badge or LinkedIn endorsement.
- Draft text and generated images are processed locally in the member's browser; they are not saved to the community database by this feature.

## Release checks

Run the repository's standard validation before merging:

- `npm run lint`
- `npm run typecheck`
- `npm run test:content`
- `npm run test:seo`
- `npm run build`

After merging, deploy the updated `community-invite` Edge Function and verify the live Pages deployment. Keep public registration closed; this change is invitation-only.
