import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/me/contacts")({
  beforeLoad: () => {
    throw redirect({ href: "/me/profile#trainer-contact-block" });
  },
});
