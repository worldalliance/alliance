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
  AGREEMENT_NOTE,
  COMMIT_PHRASE,
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
import { Rise, StepHeadline, StepNote } from "./chrome";

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
    <View className="items-start gap-2">
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
            <ProfileImage pfp={pfp} size="small" />
          </View>
        ))}
      </View>
      <Text
        className="text-white"
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
            have entered the agreement.
          </>
        ) : (
          <>
            {signedCount.toLocaleString("en-US")} members have entered the
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
    <View className="justify-center">
      <TextInput
        className="min-h-11 rounded-md border-2 bg-white px-3.5 text-base text-black"
        style={{
          height: scale.signField,
          fontSize: scale.ui,
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
      <StepNote index={2}>{AGREEMENT_NOTE}</StepNote>
      <Rise index={3}>
        <View style={{ gap: scale.cardGap }}>
          <View className="overflow-hidden rounded-lg">
            <View
              className="bg-zinc-50"
              style={{ gap: scale.cardRowGap, padding: scale.cardPad }}
            >
              {contract.description.map((item, index) => (
                <View key={item.point} className="flex-row gap-x-3">
                  <View
                    className="shrink-0 items-center justify-center rounded"
                    style={{
                      width: scale.ui * 1.7,
                      height: scale.ui * 1.7,
                      backgroundColor: onboardingColors.navy,
                    }}
                  >
                    <Text
                      weight={FontWeight.Semibold}
                      className="text-white"
                      style={{ fontSize: scale.ui * 0.9, lineHeight: scale.ui }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      weight={FontWeight.Semibold}
                      className="text-black"
                      style={{
                        fontSize: scale.ui,
                        lineHeight: scale.ui * 1.3,
                      }}
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
                </View>
              ))}

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
            </View>

            <View
              className="bg-white"
              style={{ gap: scale.noteGap, padding: scale.cardPad }}
            >
              <Text
                className="text-black"
                style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.3 }}
              >
                Type{" "}
                <Text
                  weight={FontWeight.Semibold}
                  className="text-black"
                  style={{ fontSize: scale.ui }}
                >
                  {COMMIT_PHRASE}
                </Text>{" "}
                to agree.
              </Text>
              <View style={{ gap: 6 }}>
                <CommitControl
                  typed={committed}
                  onTypedChange={onCommittedChange}
                />
                <TextInput
                  className="rounded-md border-2 bg-white px-3.5 text-black"
                  style={{
                    height: scale.signField,
                    fontSize: scale.ui,
                    borderColor: "#e4e4e7",
                  }}
                  placeholder="Sign your full name"
                  placeholderTextColor="#a1a1aa"
                  value={signedName}
                  onChangeText={onSignedNameChange}
                  autoComplete="name"
                  accessibilityLabel="Sign your full name"
                  testID="vr-onboarding-signature"
                />
              </View>

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
