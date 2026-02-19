import { Header } from "@/components/header";
import type { ReactNode } from "react";

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
