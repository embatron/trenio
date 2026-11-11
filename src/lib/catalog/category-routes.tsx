import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { CategoryRouteRef } from "@/lib/catalog/sport-taxonomy";

type CategoryLinkProps = {
  route: CategoryRouteRef;
  children: ReactNode;
  className?: string;
  activeOptions?: { exact?: boolean };
  "aria-current"?: "page";
};

export function CategoryLink({
  route,
  children,
  className,
  activeOptions,
  "aria-current": current,
}: CategoryLinkProps) {
  if (route.childSlug) {
    return (
      <Link
        className={className}
        activeOptions={activeOptions}
        aria-current={current}
        to="/categories/$parentSlug/$childSlug"
        params={{ parentSlug: route.parentSlug, childSlug: route.childSlug }}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      className={className}
      activeOptions={activeOptions}
      aria-current={current}
      to="/categories/$slug"
      params={{ slug: route.parentSlug }}
    >
      {children}
    </Link>
  );
}
