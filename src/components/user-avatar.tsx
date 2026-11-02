import { useEffect, useState } from "react";

import { PhotoImage } from "@/components/photo-image";

/** Same mark as the site icon. Shown when a portrait is missing or will not load. */
export const DEFAULT_AVATAR_SRC = "/favicon-32.png";

export function UserAvatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const photo = src?.trim() ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photo]);

  return (
    <span className="user-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {photo && !failed ? (
        <PhotoImage
          key={photo}
          src={photo}
          alt=""
          preset="avatar"
          width={size}
          height={size}
          onFinalError={() => setFailed(true)}
        />
      ) : (
        <img className="user-avatar__mark" src={DEFAULT_AVATAR_SRC} alt="" width={size} height={size} />
      )}
    </span>
  );
}
