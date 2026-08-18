export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {messages[0]}
    </p>
  );
}

export function FormBanner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
      }
    >
      {children}
    </div>
  );
}
