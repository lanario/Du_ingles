export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">Du Inglês</h1>
        {children}
      </div>
    </main>
  );
}
