import dynamic from "next/dynamic";

const NextSpaShell = dynamic(() => import("@/components/NextSpaShell"), {
  ssr: false,
});

export default function CatchAllPage() {
  return <NextSpaShell />;
}
