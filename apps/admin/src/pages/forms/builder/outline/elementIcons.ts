import {
  DISPLAY_KIND_NAMES,
  displayBlockPreview,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { markdownPlainText } from "@alliance/shared/forms/optionSearch";
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

// Their preview is a size or markup, not something to recognise them by.
const KIND_ONLY = new Set<PageItem["kind"]>(["divider", "spacer", "html"]);

const plain = (markdown: string) =>
  markdownPlainText(markdown).replace(/\s+/g, " ").trim();

/** An element's row text beside its icon: its label or text as members read it, else its kind. */
export const elementText = (item: PageItem): string => {
  if (isQuestionField(item))
    return plain(item.label ?? "") || FIELD_KIND_NAMES[item.kind];
  const name = DISPLAY_KIND_NAMES[item.kind];
  if (item.kind === "images") return item.images[0]?.alt?.trim() || name;
  if (KIND_ONLY.has(item.kind)) return name;
  return plain(displayBlockPreview(item)) || name;
};
