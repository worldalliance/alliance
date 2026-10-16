# Decisions

- **Message copy.** The failure reads "The agreement you signed couldn't be loaded." (`signedAgreementLoadFailed` in `shared/lib/copy.ts`). The existing `membershipAgreementLoadFailed` names the agreement generally and already shows for the current contract, so reusing it would leave two identical messages on the page when both fail (requirement 3).
- **Placement.** The `LoadFailed` sits inside the Agreement card, in the previously signed contract's slot, and the card renders when only that failure is present. It does not get its own card, unlike the current-contract failure, since the latest contract usually loads below it.
- **Failure test.** `failedToLoad` from `shared/lib/failedToLoad.ts` decides the failure, the same helper the current-contract failure uses, so a retry in flight keeps the message up instead of flashing back to nothing.
