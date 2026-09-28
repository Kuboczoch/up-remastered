import Link from "next/link";
import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";

import styles from "../request.module.css";
import { ManageRequest } from "./manage-request";

export const metadata: Metadata = {
  title: createPageTitle("Manage upload request"),
};

export default function ManageUploadRequestPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.shell}>
        <header className={styles.header}>
          <Link href="/">← Home</Link>
          <h1>Manage upload request.</h1>
          <p>Check its status or revoke it before a file is uploaded.</p>
        </header>
        <ManageRequest />
      </main>
      <SiteFooter />
    </>
  );
}
