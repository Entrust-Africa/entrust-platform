import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design system",
};

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
