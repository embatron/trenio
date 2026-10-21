import Avatar from "boring-avatars";

import { PhotoImage } from "@/components/photo-image";

const COLORS = ["#f04b50", "#111827", "#f6b4b6", "#9ca3af", "#ffe4e6"];

export function UserAvatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const label = name.trim() || "Пользователь";
  return (
    <span className="user-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {src ? (
        <PhotoImage src={src} alt="" preset="avatar" width={size} height={size} />
      ) : (
        <Avatar size={size} name={label} variant="beam" colors={COLORS} title={false} />
      )}
    </span>
  );
}
