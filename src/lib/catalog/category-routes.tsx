import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { CategoryRouteRef } from "@/lib/catalog/sport-taxonomy";

type CategoryLinkProps = Omit<LinkProps, "to" | "params" | "children"> & {
  route: CategoryRouteRef;
  children: ReactNode;
};

export function CategoryLink({ route, children, ...props }: CategoryLinkProps) {
  if (route.childSlug) {
    return (
      <Link
        {...props}
        to="/categories/$parentSlug/$childSlug"
        params={{ parentSlug: route.parentSlug, childSlug: route.childSlug }}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link {...props} to="/categories/$slug" params={{ slug: route.parentSlug }}>
      {children}
    </Link>
  );
}
