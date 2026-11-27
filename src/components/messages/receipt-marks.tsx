export function ReceiptMarks({ receipt }: { receipt: "sent" | "delivered" | "read" }) {
  const read = receipt === "read";
  const label = read ? "Прочитано" : receipt === "delivered" ? "Доставлено" : "Отправлено";
  return (
    <span className={`direct-receipt is-${receipt}`} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {read ? (
          <>
            <path d="M1.5 12.5 6 17l7.5-9" />
            <path d="M8 12.5 12.5 17 22 6.5" />
          </>
        ) : (
          <path d="M5 12.5 10 17.5 19.5 7" />
        )}
      </svg>
      <span className="direct-receipt__label">{label}</span>
    </span>
  );
}
