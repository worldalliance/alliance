# Decisions

- Store `showReferralMessage` on each organization waitlist link. Default to true to preserve existing links.
- Provide the checkbox when creating links and inline for existing links in the Organizations panel. Short custom URLs inherit the destination waitlist link's setting.
- Suppress the organization banner, logo, and social proof by returning empty presentation fields from the existing referral endpoint. Preserve organization and source-link attribution during signup.
- Personal referral links continue to identify their inviter, even when their source link hides organization messaging. The setting applies to the reusable organization link.
