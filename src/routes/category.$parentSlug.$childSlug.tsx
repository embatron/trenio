import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/category/$parentSlug/$childSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/categories/$parentSlug/$childSlug",
      params: {
        parentSlug: params.parentSlug,
        childSlug: params.childSlug,
      },
    });
  },
});
