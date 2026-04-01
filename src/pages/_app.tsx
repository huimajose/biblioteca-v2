import type { AppProps } from "next/app";
import "@/index.css";

export default function NextApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
