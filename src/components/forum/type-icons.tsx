import {
  AudioIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  VideoIcon,
} from "@/components/icons";
import type { ForumFilter } from "@/lib/forum/filters";

const ICONS: Record<ForumFilter, (p: { size?: number }) => React.JSX.Element> =
  {
    audio: AudioIcon,
    imagen: ImageIcon,
    documento: FileIcon,
    video: VideoIcon,
    enlace: LinkIcon,
  };

export function TypeIcon({
  type,
  size = 18,
}: {
  type: ForumFilter;
  size?: number;
}) {
  const Icon = ICONS[type];
  return <Icon size={size} />;
}

// Iconitos chicos con el tipo de material de una publicación (cada uno con su nombre para lectores de pantalla).
export function TypeBadges({
  groups,
  labels,
}: {
  groups: ForumFilter[];
  labels: Record<ForumFilter, string>;
}) {
  if (groups.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tipos de material">
      {groups.map((g) => (
        <li
          key={g}
          title={labels[g]}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-verde-claro text-verde-oscuro"
        >
          <TypeIcon type={g} size={16} />
          <span className="sr-only">{labels[g]}</span>
        </li>
      ))}
    </ul>
  );
}
