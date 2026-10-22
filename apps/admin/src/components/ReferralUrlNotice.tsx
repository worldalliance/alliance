const REFERRAL_URL_PREVIEW =
  "https://alliance.example/actions/123?sid=member-code";

export function ReferralUrlNotice() {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-950">
            Member Referral URL
          </p>
          <p className="mt-1 text-xs text-blue-800">
            This is always appended automatically when the action is shared. It
            is not editable here and cannot be removed from the real share text.
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-900">
          Always Included
        </span>
      </div>
      <div className="mt-3 rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-900">
        {REFERRAL_URL_PREVIEW}
      </div>
    </div>
  );
}
