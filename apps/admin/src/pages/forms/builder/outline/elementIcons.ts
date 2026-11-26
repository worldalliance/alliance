import {
  DISPLAY_KIND_NAMES,
  displayBlockPreview,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import {
  AlignLeft,
  ArrowDownUp,
  BadgeCheck,
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  CircleDot,
  Clock,
  Code,
  Copy,
  FileSignature,
  Globe,
  Hash,
  Heading,
  History,
  Images,
  ImageUp,
  Link,
  List,
  ListChecks,
  LocateFixed,
  Mail,
  MapPin,
  MessageSquareText,
  MessagesSquare,
  Minus,
  MoveVertical,
  Paperclip,
  Phone,
  Pilcrow,
  Puzzle,
  Quote,
  SlidersHorizontal,
  SquareCheck,
  Tag,
  Timer,
  ToggleLeft,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<PageItem["kind"], LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  email: Mail,
  phone: Phone,
  number: Hash,
  range: SlidersHorizontal,
  checkbox: SquareCheck,
  radio: CircleDot,
  select: ChevronDown,
  multiselect: ListChecks,
  ranking: ArrowDownUp,
  date: Calendar,
  time: Clock,
  timezone: Globe,
  city: MapPin,
  file: Paperclip,
  contract: FileSignature,
  list: List,
  custom: Puzzle,
  image: ImageUp,
  toggle: ToggleLeft,
  timePicker: Timer,
  conversation: MessagesSquare,
  header: Heading,
  label: Tag,
  divider: Minus,
  spacer: MoveVertical,
  html: Code,
  images: Images,
  video: Video,
  quote: Quote,
  biglink: Link,
  copytext: Copy,
  previousAnswer: History,
  userLocation: LocateFixed,
  chatTranscript: MessageSquareText,
  expertMessage: BadgeCheck,
  accordion: ChevronsUpDown,
};

/** The icon before an element's row in the outline; the row's name says its kind in words. */
export const elementIcon = (item: PageItem): LucideIcon =>
  kindIcon({ kind: item.kind, question: isQuestionField(item) });

/** A question's `text` is a short answer, a block's is a paragraph. */
export const kindIcon = ({
  kind,
  question,
}: {
  kind: PageItem["kind"];
  question: boolean;
}): LucideIcon => (kind === "text" && !question ? Pilcrow : ICONS[kind]);

// Their preview is a size, not something to recognise them by.
const SIZE_ONLY = new Set<PageItem["kind"]>(["divider", "spacer"]);

/** An element's row text beside its icon: its label or text, else its kind. */
export const elementText = (item: PageItem): string =>
  isQuestionField(item)
    ? item.label?.trim() || FIELD_KIND_NAMES[item.kind]
    : (!SIZE_ONLY.has(item.kind) && displayBlockPreview(item).trim()) ||
      DISPLAY_KIND_NAMES[item.kind];
