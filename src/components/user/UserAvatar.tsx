"use client";

import Image from "next/image";
import { useState } from "react";

interface UserAvatarProps {
  name: string | null;
  image: string | null;
  className?: string;
}

export function UserAvatar({ name, image, className = "" }: UserAvatarProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = parts.length
    ? [parts[0], ...(parts.length > 1 ? parts.slice(-1) : [])]
      .map(part => Array.from(part)[0]).join("").toUpperCase()
    : "?";

  return (
    <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-semibold text-primary ${className}`}>
      {image && image !== failedImage ? (
        <Image src={image} alt="" width={36} height={36} unoptimized referrerPolicy="no-referrer" onError={() => setFailedImage(image)} className="size-full object-cover" />
      ) : initials}
    </span>
  );
}
