import type {
  ContractDto,
  ProfileDto,
  ReferrerProfileDto,
} from "@alliance/shared/client";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  AGREEMENT_HEADLINE,
  COMMIT_PHRASE,
  COMMITMENT_STATEMENT,
  DETAILS_LINK,
  isCommitted,
} from "../../lib/onboarding/content";
import {
  motion,
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";
import { Rise, StepHeadline } from "./chrome";

/** Overlapping faces stop fitting the panel's width past this. */
const FACE_COUNT = 5;

function SignedBy({
  inviter,
  faces,
  signedCount,
}: {
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  signedCount: number;
}) {
  const scale = useOnboardingScale();
  const pictures = [
    ...(inviter ? [inviter.profilePicture] : []),
    ...faces.map((face) => face.profilePicture),
  ].slice(0, FACE_COUNT);

  return (
    <View className="items-center gap-2">
      <View className="flex-row">
        {pictures.map((pfp, i) => (
          <View
            key={i}
            style={{
              marginRight: i === pictures.length - 1 ? 0 : -8,
              borderWidth: 2,
              borderColor: onboardingColors.navy,
              borderRadius: 6,
            }}
          >
            <ProfileImage pfp={pfp} size="medium" />
          </View>
        ))}
      </View>
      <Text
        className="text-center text-white"
        style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.35 }}
      >
        {inviter ? (
          <>
            <Text
              weight={FontWeight.Medium}
              className="text-white"
              style={{ fontSize: scale.ui }}
            >
              {inviter.displayName}
            </Text>{" "}
            and {Math.max(signedCount - 1, 0).toLocaleString("en-US")} others
            have signed the agreement.
          </>
        ) : (
          <>
            {signedCount.toLocaleString("en-US")} members have signed the
            agreement.
          </>
        )}
      </Text>
    </View>
  );
}

function CommitControl({
  typed,
  onTypedChange,
}: {
  typed: string;
  onTypedChange: (value: string) => void;
}) {
  const scale = useOnboardingScale();
  const done = isCommitted(typed);

  return (
    <View className="gap-1.5">
      <Text
        className="text-black"
        style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.3 }}
      >
        {COMMITMENT_STATEMENT} Type{" "}
        <Text
          weight={FontWeight.Semibold}
          className="text-black"
          style={{ fontSize: scale.ui }}
        >
          {COMMIT_PHRASE}
        </Text>{" "}
        to agree.
      </Text>
      <View className="justify-center">
        <TextInput
          className="min-h-11 rounded-md border-2 bg-white px-3.5 text-base text-black"
          style={{
            borderColor: done ? onboardingColors.accentGreen : "#e4e4e7",
          }}
          placeholder={COMMIT_PHRASE}
          placeholderTextColor="#a1a1aa"
          value={typed}
          onChangeText={onTypedChange}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`Type ${COMMIT_PHRASE} to agree`}
          testID="vr-onboarding-commit"
        />
        {done && (
          <View className="absolute right-3">
            <Check
              size={18}
              color={onboardingColors.accentGreen}
              strokeWidth={3}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function AgreementStep({
  contract,
  inviter,
  faces,
  signedCount,
  committed,
  onCommittedChange,
  signedName,
  onSignedNameChange,
  error,
  received,
}: {
  contract: ContractDto;
  inviter: ReferrerProfileDto | null;
  faces: ProfileDto[];
  signedCount: number;
  /** The raw text the member has typed into the commitment field. */
  committed: string;
  onCommittedChange: (value: string) => void;
  signedName: string;
  onSignedNameChange: (name: string) => void;
  error: string | null;
  /** Only after Join is pressed, which is what the bar confirms. */
  received: boolean;
}) {
  const scale = useOnboardingScale();
  const router = useRouter();

  return (
    <>
      <StepHeadline>{AGREEMENT_HEADLINE}</StepHeadline>
      <Rise index={2}>
        <View style={{ gap: scale.cardGap }}>
          <View className="overflow-hidden rounded-lg bg-white">
            <View style={{ gap: scale.cardRowGap, padding: scale.cardPad }}>
              {contract.description.map((item) => (
                <View key={item.point}>
                  <Text
                    weight={FontWeight.Semibold}
                    className="text-black"
                    style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.3 }}
                  >
                    {item.point}
                  </Text>
                  {item.subtext.trim() !== "" && (
                    <Text
                      className="text-zinc-700"
                      style={{
                        fontSize: scale.ui * 0.9,
                        lineHeight: scale.ui * 1.2,
                      }}
                    >
                      {item.subtext}
                    </Text>
                  )}
                </View>
              ))}

              <CommitControl
                typed={committed}
                onTypedChange={onCommittedChange}
              />

              <Pressable
                onPress={() => router.push("/information")}
                className="-mt-1 self-start"
              >
                <Text
                  style={{
                    fontSize: scale.caption,
                    color: onboardingColors.accentGreen,
                  }}
                >
                  {DETAILS_LINK}
                </Text>
              </Pressable>

              <TextInput
                className="rounded-md border border-zinc-300 bg-zinc-100 px-3.5 text-black"
                style={{ height: scale.signField, fontSize: scale.ui }}
                placeholder="Sign your full name to agree"
                placeholderTextColor="#71717a"
                value={signedName}
                onChangeText={onSignedNameChange}
                autoComplete="name"
                accessibilityLabel="Sign your full name to agree"
                testID="vr-onboarding-signature"
              />

              {error && (
                <Text
                  weight={FontWeight.Medium}
                  className="text-red-600"
                  style={{ fontSize: scale.ui }}
                  accessibilityRole="alert"
                >
                  {error}
                </Text>
              )}
            </View>

            {received && (
              <Animated.View
                entering={FadeIn.duration(motion.stepFadeMs)}
                className="flex-row items-center gap-2 px-6 py-2.5"
                style={{ backgroundColor: onboardingColors.accentGreen }}
              >
                <Check size={16} color="#fff" />
                <Text
                  weight={FontWeight.Medium}
                  className="text-white"
                  style={{ fontSize: scale.ui }}
                >
                  Agreement Received
                </Text>
              </Animated.View>
            )}
          </View>

          <SignedBy inviter={inviter} faces={faces} signedCount={signedCount} />
        </View>
      </Rise>
    </>
  );
}
