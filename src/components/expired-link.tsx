import { Link } from "@tanstack/react-router";

import { AuthStyles } from "@/components/auth-styles";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export function ExpiredLink({ text }: { text: string }) {
  return (
    <div className="auth-page">
      <AuthStyles />
      <SiteHeader />
      <main className="auth-main">
        <div className="auth-card auth-card--expired">
          <div className="auth-expired__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10.5 13.5a4.5 4.5 0 0 0 6.4.5l1.2-1.2" />
              <path d="M13.5 10.5a4.5 4.5 0 0 0-6.4-.5l-1.2 1.2" />
              <path d="M8.2 8.2 6 6" />
              <path d="M15.8 15.8 18 18" />
              <path d="M5 19 19 5" />
            </svg>
          </div>
          <h1 className="auth-title">Ссылка уже не действует</h1>
          <p className="auth-sub">{text}</p>
          <Link to="/" className="auth-submit auth-expired__home">На главную</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
