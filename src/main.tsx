import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react-router';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = 'pk_test_aGFybWxlc3MtbW9ua2V5LTQxLmNsZXJrLmFjY291bnRzLmRldiQ';

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk publishable key in environment variables.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
        afterSignOutUrl="/sign-in"
      >
        <App />
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
);
