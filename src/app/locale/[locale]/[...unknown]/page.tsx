import { notFound } from "next/navigation";
/** Only reachable through the locale UI subtree; never captures raw file URLs. */
export default function MissingLocalizedPage() {
  notFound();
}
