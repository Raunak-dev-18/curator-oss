import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <main className="not-published-page">
      <div className="not-published-atmosphere" aria-hidden="true" />
      <section className="not-published-card">
        <span className="not-published-brand">
          <BrandMark />
          Cognix
        </span>
        <p className="not-published-code">404</p>
        <h1>This project is not published</h1>
        <p className="not-published-copy">
          Nothing is being served at this address. The link may be mistyped, or the owner unpublished the project or
          moved it to a different domain.
        </p>
        <div className="not-published-actions">
          <Link href="/">Build an app with Cognix</Link>
          <a href="https://github.com/Raunak-dev-18/cognix-ai-appbuilder" target="_blank" rel="noreferrer">
            Read the docs
          </a>
        </div>
        <p className="not-published-hint">
          If you own this project, open it in Cognix, publish the latest build, and confirm the domain shows as live.
        </p>
      </section>
    </main>
  );
}
