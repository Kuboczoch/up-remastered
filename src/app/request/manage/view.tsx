import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";
import { T } from "@/lib/i18n/provider";

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
          {/* Reload the public URL so browser history restores locale metadata. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">
            <T id="← Home" />
          </a>
          <h1>
            <T id="Manage upload request." />
          </h1>
          <p>
            <T id="Check its status or revoke it before a file is uploaded." />
          </p>
        </header>
        <ManageRequest />
      </main>
      <SiteFooter />
    </>
  );
}
