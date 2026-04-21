export const noTasksToDoRightNow = "No tasks to do right now";
export const noTasksContractSuspended =
  "You will not be assigned tasks while you do not have a signed membership contract.";

export const taskHeaders = {
  actionPage: {
    completed: "You've completed this task.",
    deadlinePassed: {
      title: "The deadline for member action has passed.",
      description:
        "You do not need to complete this task, but you can still do so below if you would like.",
    },
    externalOnly:
      "This action is intended for external participants. Members cannot complete it.",
    memberActionClosed: "This action no longer requires member participation.",
    notAssigned: "You have not been assigned this task. No action is needed.",
    onboardingSignContractFirst:
      "Please sign the contract before continuing with the onboarding process.",
    optional: {
      title: "This action is optional.",
      description:
        "You are not required to complete the task, but can if you would like.",
    },
    withdrew: "You withdrew from this action.",
  },
  homePage: {
    away: {
      title: "Away",
      description: {
        currentlyAway:
          "You are currently away, so this task is optional for you. You can either complete it or dismiss it.",
        wasAway:
          "You were away during this task, so it is optional for you. You can either complete it or dismiss it.",
        willBeAway:
          "You will be away before this task is due, so it is optional for you. You can either complete it or dismiss it.",
      },
    },
    deadline: {
      title: "Deadline passed",
      description:
        "You have missed this task's deadline. You can either complete it or dismiss it.",
    },
    optional: {
      title: "This action is optional.",
      description: "You can complete the task as usual or dismiss it.",
    },
  },
} as const;

export const awayRangesDescription =
  "You can schedule a period of time when you won't be able to complete Alliance actions. This will let the office know not to expect you to complete tasks while you're away.";

export const leaveGroupConfirmation =
  "Are you sure you want to leave this group? You will not be able to rejoin unless you are invited again.";
export const requestGroupAssignmentConfirmation =
  "Are you sure you want to be reassigned to a different group? During this process, you will be removed from your current group. Note that this process may take a few days.";

export const groupSettings = {
  public: {
    name: "Let anyone join this group",
    explanation: "Anyone can join this group without your approval.",
  },
  allowMemberInvites: {
    name: "Let group members invite new members to this group",
    explanation:
      "When group members invite new members to the Alliance, they will be added to this group (capacity permitting).",
  },
  allowStaffAssignments: {
    name: "Let staff assign members to this group",
    explanation:
      "Members may occasionally be assigned to this group by Alliance staff.",
  },
  maxCapacity: {
    name: "Member capacity",
    explanation: "The maximum number of members that can be in this group.",
  },
} as const;

export const onetimeInviteCreation = {
  title: "Invite a new member",
  explanation: [
    "Once you create an invite, you will get a personal invite link to share.",
  ],
  assignToOpenGroup: "Assign them to any open group",
  createNewGroupOption: "Create a new group",
  inviteeContextExplanation:
    "(Optional) Any context you are comfortable sharing with the office, such as how you know them, why they are a fit, how you will send the link, etc. This is not shown on the invite.",
  groupContext:
    "New members usually have a better experience when they know their group lead personally.",
  responsible: {
    buttonText: "Myself",
    leader: {
      title: "Which group should they join?",
      invite: {
        title: "Create an invite",
        explanation: [
          "When the invitee signs up, they will be added to your group automatically.",
        ],
      },
      newGroup: {
        title: "Create a new group",
        createButtonText: "Create group and invite",
      },
    },
  },
  not_responsible: {
    buttonText: "Someone else",
    title: "Create an invite",
    explanations: {
      genericGroup: [
        "A staff member will place them in a group with open space after they sign up.",
      ],
      yourGroup: [
        "If your current group has available space, the invitee will be added to it; otherwise staff will assign them to another open group.",
      ],
      yourGroupNoCapacity: [
        "Your group is full, so they will be assigned elsewhere after they sign up.",
      ],
    },
  },
} as const;

export const onetimeInviteCreationGroup = {
  leader: {
    title: "Invite a new member to the Alliance and your group",
    explanation: [
      "This will create a personalized sign-up page that explains the Alliance.",
      "When the new member signs up, they will automatically be added to your group.",
    ],
  },
  member: {
    title: "Invite a new member to the Alliance and this group",
    explanation: "A group leader will review and approve your request.",
    bullets: [
      "A group lead will first need to approve the request for the invitee.",
      "Once approved, you will receive a personalized sign-up link that you can share with the invitee.",
      "When the invitee signs up, they will automatically be added to your group.",
    ],
  },
} as const;

export const inviteBuckets = {
  actionable: {
    title: "Invites that need approval",
  },
  unverifiableActionable: {
    title: "Invites to be sent",
    description: "These invites are ready to be sent.",
  },
  waitingForResponse: {
    title: "No action needed",
    description: "Other members need to respond to these invites.",
  },
  settled: {
    title: "Past invites",
    description: "These invites have been accepted or rejected.",
  },
} as const;

/** Shared labels for onetime invite status; each app maps to its own style (e.g. Tailwind class). */
export const onetimeInviteStatusLabels = {
  request_pending: "Request pending",
  request_rejected: "Rejected",
  link_used: "Accepted",
  link_unused: "Pending",
} as const;

export const deleteInviteConfirmation = {
  message: "Are you sure you want to delete this invite?",
  confirmLabel: "Yes, delete it",
  cancelLabel: "No, keep it",
} as const;

/** Copy for referral QR code (e.g. invites screen). */
export const referralQrCopy = {
  caption: "Share this QR code to invite a friend to the Alliance.",
  linkUnavailable: "Your referral link is not available.",
} as const;

export const clipboardCopy = {
  share: "Share",
  copiedToClipboard: "Copied to clipboard",
  exportJson: "Export JSON",
  inClipboard: "in clipboard",
} as const;

export const guestReferral = {
  inviteToTryTask: (firstName: string) =>
    `${firstName} has invited you to try this task.`,
  defaultReferrerName: "Your friend",
  allianceIntro:
    "The Alliance is a global group of people cooperating to improve the world. Join us!",
  tryOutTaskButton: "Try out this task",
  completionIntegrityExplanation:
    "To maintain the integrity of our data, only member-submitted forms are formally processed.",
  joinToCountContributions:
    "Want your work to count? Join the Alliance to ensure your future contributions are acted upon.",
  createAccountToSubmit: "Create an account to submit",
} as const;

export const suspendContractConfirmation =
  "Are you sure you want to suspend your contract? You will be removed from your groups.";

export const outputFieldPublicToggle = {
  showPublicly: "Show my response to other members",
  hidePublicly: "Hide my response from others",
} as const;

export const forgotPassword = {
  prompt: "Forgot password?",
  emailRequired: {
    title: "Enter your email",
    message: 'Enter an email address above, then try "Forgot password?" again.',
  },
  sendError: "Error sending password reset email.",
  sendSuccess: {
    title: "Check your email",
    message:
      "A link to reset your password has been sent to your email address.",
  },
} as const;
