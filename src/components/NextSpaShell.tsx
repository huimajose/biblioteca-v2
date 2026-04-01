import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "@/App";

export default function NextSpaShell() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <main style={{ padding: "1rem", fontFamily: "sans-serif" }}>
        Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables.
      </main>
    );
  }

  return (
    <BrowserRouter>
      <ClerkProvider
        publishableKey={publishableKey}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        afterSignOutUrl="/sign-in"
      >
        <App />
      </ClerkProvider>
    </BrowserRouter>
  );
}
