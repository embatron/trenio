import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="trenio-toast"
      position="top-center"
      offset="calc(var(--header-clearance, 16px) + 8px)"
      toastOptions={{
        classNames: {
          toast: "trenio-toast__card",
          title: "trenio-toast__title",
          description: "trenio-toast__text",
          actionButton: "trenio-toast__action",
          cancelButton: "trenio-toast__cancel",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
