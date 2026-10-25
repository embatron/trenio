import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useFavorites } from "@/components/favorites-store";
import { useMessaging } from "@/components/messages/messages-live";
import { logoutFn } from "@/lib/auth/functions";
import { getCabinetPath, hasAnyRole, isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { pluralRu } from "@/lib/ru-plural";
import { BELARUS_OBLAST_CENTERS } from "@/lib/catalog/city-taxonomy";
import { cityCatalogSlug } from "@/lib/catalog/city-pages";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { UserAvatar } from "@/components/user-avatar";
import { TrainerName } from "@/components/trainer-name";
import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";
import { useEffect, useRef, useState, type ReactNode } from "react";

const CHROME_CSS = `
.site-header {
  position: sticky; top: 0; z-index: 300;
  --form-audience-w: 131px;
  --form-format-w: 157px;
  --form-sport-w-header: 211px;
  --form-location-w-header: 147px;
  background: transparent;
  backdrop-filter: none; -webkit-backdrop-filter: none;
  transition: background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease;
  border-bottom: 1px solid transparent;
}
body.is-search-docked .site-header,
.site-header.is-scrolled {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow: 0 1px 0 rgba(var(--dark-rgb), 0.04), 0 8px 28px rgba(var(--dark-rgb), 0.05);
  border-bottom-color: rgba(var(--dark-rgb), 0.06);
}
.site-header.is-menu-open,
body.is-search-docked .site-header.is-menu-open {
  background: var(--white);
  backdrop-filter: none; -webkit-backdrop-filter: none;
  box-shadow: none;
  border-bottom-color: transparent;
  overflow: visible;
}

.site-header__inner {
  width: 100%; max-width: var(--layout-max); margin: 0 auto; padding: 24px var(--layout-gutter);
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; column-gap: 28px;
  transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
body.is-search-docked .site-header__inner { padding: 12px var(--layout-gutter); column-gap: 10px; }
.site-header__search {
  min-width: 0; overflow: hidden; opacity: 0; max-height: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: flex-start;
  transition: opacity 0.35s ease, max-height 0.4s ease;
}
body.is-search-docked .site-header__search {
  opacity: 1; max-height: 80px; overflow: visible; pointer-events: auto;
}
.search-block--header { width: min(100%, 700px); max-width: 100%; min-width: 0; }
.search-block--header .search-shell {
  width: 100%; max-width: 100%; min-width: 0; min-height: 52px; padding: 4px 5px;
  background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: 999px;
  box-shadow: 0 4px 18px rgba(var(--dark-rgb), 0.06);
  display: grid; grid-template-columns: minmax(0, 118fr) minmax(0, 196fr) minmax(0, 190fr) minmax(0, 142fr) 44px;
  align-items: center; gap: 0; text-align: left;
}
.search-block--header .search-field { min-width: 0; height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 11px; }
.search-block--header .search-field.intent-select { position: relative; }
.search-block--header .search-field + .search-field { border-left: 1px solid var(--line); }
.search-block--header .search-icon { flex: 0 0 auto; display: grid; place-items: center; color: var(--muted); }
.search-block--header .search-icon svg,
.search-block--header .intent-dropdown__trigger svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.search-block--header .intent-dropdown__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 7px;
  width: 100%; min-width: 0; min-height: 44px; height: 100%; padding: 0; border: 0; background: transparent;
  color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; overflow: hidden;
}
.search-block--header .intent-dropdown__value { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.search-block--header .intent-dropdown__trigger svg { color: var(--muted); flex: 0 0 auto; }
.search-block--header .field-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.search-block--header .combo-select { position: relative; min-width: 0; }
.search-block--header .combo-input {
  width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent;
  color: var(--text); font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.search-block--header .combo-input::placeholder { color: var(--muted); }
.search-block--header .combo-menu {
  position: absolute; z-index: 5; top: calc(100% + 11px); left: 7px; right: 7px;
  min-width: 219px; padding: 6px; border: 1px solid rgba(var(--dark-rgb), 0.08);
  border-radius: var(--card-radius); background: var(--white); box-shadow: 0 18px 46px rgba(var(--dark-rgb), 0.13); display: none;
}
.search-block--header .combo-select.is-open .combo-menu { display: grid; gap: 1px; }
.search-block--header .combo-select[data-combo="location"] .combo-menu { max-height: 320px; overflow-y: auto; }
.search-block--header .combo-option {
  border: 0; width: 100%; min-height: 44px; padding: 0 12px; border-radius: var(--radius-control);
  background: transparent; color: var(--text); cursor: pointer; font-size: 14px; font-weight: var(--fw-title); text-align: left;
}
.search-block--header .combo-option:hover,
.search-block--header .combo-option.is-active { background: var(--light-bg); color: var(--primary-dark); }
.search-block--header .search-submit {
  width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--primary); color: #fff;
  cursor: pointer; display: grid; place-items: center;
}
.search-block--header .search-submit svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.logo {
  display: inline-flex; align-items: center; justify-content: flex-start;
  min-height: 44px; flex: 0 0 auto; line-height: 0; text-decoration: none;
}
.logo__img { display: block; height: 28px; width: auto; }
.logo__img--on-dark, .logo__img--knockout { display: none; }
.site-header .logo__img { height: 26px; }
.site-footer__brand .logo__img--color,
.site-footer__brand .logo__img--knockout { display: none; }
.site-footer__brand .logo__img--on-dark { display: block; }
.site-header__nav { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 44px; height: 44px; border-radius: 999px; border: 0;
  background: transparent; display: inline-grid; place-items: center;
  color: var(--dark); cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
  text-decoration: none;
}
.icon-btn:hover, .icon-btn[aria-current="page"] { background: transparent; color: var(--primary); transform: none; }
.icon-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.favorite-count { position: relative; width: 44px; height: 44px; }
.favorite-count__n {
  position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 999px; background: var(--primary); color: #fff;
  font-size: 10px; font-weight: var(--fw-title); line-height: 16px; text-align: center;
}
.favorite-count.has-items { color: var(--primary); }
.favorite-count.has-items svg { fill: currentColor; }
.icon-btn--help { font-size: 15px; font-weight: var(--fw-title); letter-spacing: 0; }
.account-face {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-width: 44px; min-height: 44px; max-width: 210px;
  padding-right: 2px; border-radius: 999px; color: var(--dark); text-decoration: none;
}
.account-face__nick {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: var(--fw-title); letter-spacing: -0.01em;
}
.account-face:hover .account-face__nick { color: var(--primary); }
.account-menu { position: relative; }
.account-menu__panel {
  display: none; position: absolute; z-index: 40; top: 100%; right: 0; padding-top: 8px;
}
.account-menu.is-open .account-menu__panel { display: block; }
.account-menu__card {
  min-width: 220px; padding: 6px; border: 1px solid rgba(var(--primary-rgb), 0.14);
  border-radius: var(--card-radius); background: var(--light-bg);
  box-shadow: 0 18px 46px rgba(var(--primary-rgb), 0.16); display: grid;
}
.account-menu__item {
  min-height: 44px; padding: 0 12px; border: 0; border-radius: var(--radius-control);
  background: transparent; color: var(--text); display: flex; align-items: center; gap: 10px;
  font: inherit; font-size: 14px; font-weight: var(--fw-title); text-align: left;
  text-decoration: none; cursor: pointer; white-space: nowrap;
}
.account-menu__item svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.account-menu__item:hover { background: var(--white); color: var(--primary-dark); }
.account-menu__count { margin-left: auto; min-width: 1.5em; color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
.account-menu__count.is-hot { color: var(--primary); }
.account-menu__rule { height: 1px; margin: 4px 8px; background: rgba(var(--primary-rgb), 0.16); }
.account-menu__logout { color: var(--muted); }
.account-menu__logout:hover { color: var(--primary-dark); }
.account-menu__logout:disabled { cursor: default; opacity: 0.7; }
.burger-btn { width: 44px; padding: 0; min-width: 0; }
.burger-btn__bars { display: inline-flex; flex-direction: column; gap: 5px; }
.burger-btn__bars span { width: 20px; height: 2px; background: currentColor; border-radius: 2px; transition: transform 0.2s ease, opacity 0.2s ease; }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(2) { opacity: 0; }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.burger-btn__label { display: none; }


.mega-overlay {
  position: fixed; inset: 0; z-index: 290; background: rgba(var(--dark-rgb), 0.46);
  opacity: 0; pointer-events: none;
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.mega-overlay.is-open { opacity: 1; pointer-events: auto; }
.mega-panel {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 30;
  width: 100%;
  max-height: calc(100dvh - var(--header-h, var(--header-clearance)));
  overflow: auto; overscroll-behavior: contain;
  transform: translate3d(0, -10px, 0);
  background: var(--white);
  box-shadow: 0 28px 56px rgba(var(--primary-rgb), 0.16);
  opacity: 0; pointer-events: none; visibility: hidden;
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0.28s;
}
.mega-panel.is-open {
  opacity: 1; transform: translate3d(0, 0, 0); pointer-events: auto; visibility: visible;
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s;
}
.mega-panel::before {
  content: ""; position: sticky; top: 0; z-index: 4; display: block; height: 3px;
  background: var(--primary);
}
.mega-cats {
  position: sticky; top: 3px; z-index: 3;
  background: var(--white);
  border-bottom: 1px solid var(--line);
}
.mega-cats .mega-sheet { padding-top: 16px; padding-bottom: 14px; }
.mega-cats__row {
  display: grid; grid-template-columns: repeat(8, minmax(112px, 1fr));
  gap: 16px 12px; margin: 0; padding: 0; list-style: none;
}
.mega-cat {
  display: grid; justify-items: center; align-content: start; gap: 8px;
  box-sizing: border-box; width: 100%; max-width: 148px; justify-self: center;
  min-width: 0; min-height: 44px; padding: 0 8px;
  color: var(--text); text-decoration: none; text-align: center;
  font-size: 11px; font-weight: var(--fw-title); letter-spacing: -0.01em; line-height: 1.25;
}
.mega-cat:hover { color: var(--primary-dark); }
.mega-cat:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--radius-control); }
.mega-cat__icon {
  width: 64px; height: 64px; flex: 0 0 auto;
  display: grid; place-items: center;
}
.mega-cat__icon img { width: 64px; height: 64px; object-fit: contain; display: block; }
.mega-cat__label { display: block; width: 100%; text-wrap: balance; }
.mega-sheet {
  width: 100%; max-width: var(--layout-max); margin-inline: auto;
  padding: 32px var(--layout-gutter) 18px;
}
.mega-grid {
  display: grid; grid-template-columns: minmax(220px, 1.2fr) repeat(3, minmax(0, 1fr));
  gap: 32px; align-items: stretch;
}
.mega-col { min-width: 0; align-self: start; display: grid; gap: 14px; align-content: start; }
.mega-col h5 {
  margin: 0;
  font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.01em;
  text-transform: none; color: var(--muted);
}
.mega-col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; }
.mega-link {
  display: flex; align-items: center; gap: 8px;
  min-height: 44px; margin: 0 -12px; padding: 8px 12px;
  border-radius: var(--radius-control);
  color: var(--dark); text-decoration: none;
  font-size: 15px; font-weight: var(--fw-title); letter-spacing: -0.01em; line-height: 1.35;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.mega-link:hover { background: var(--light-bg); color: var(--primary-dark); }
.mega-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.mega-mark {
  width: 16px; height: 16px; flex: 0 0 auto;
  display: grid; place-items: center; color: var(--primary);
}
.mega-mark svg {
  width: 16px; height: 16px; stroke: currentColor; fill: none;
  stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round;
}
.mega-col__hero {
  align-self: stretch; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 0;
  padding: 20px 22px; border-radius: var(--card-radius);
  background: linear-gradient(120deg, var(--primary) 0%, #ff7a5c 55%, var(--primary-dark) 100%);
  box-shadow: var(--shadow);
  color: #fff;
}
.mega-col__hero::before,
.mega-col__hero::after {
  content: ""; position: absolute; border-radius: 50%; pointer-events: none;
}
.mega-col__hero::before {
  right: -48px; top: -56px; width: 160px; height: 160px;
  background: rgba(255, 255, 255, 0.12);
}
.mega-col__hero::after {
  left: -46px; bottom: -78px; width: 140px; height: 140px;
  background: rgba(0, 0, 0, 0.08);
}
.mega-kicker {
  position: relative; z-index: 1; margin: 0 0 6px;
  font-size: 15px; font-weight: var(--fw-title); letter-spacing: -0.01em;
  text-transform: none; color: rgba(255, 255, 255, 0.86);
}
.mega-col__hero h4 {
  position: relative; z-index: 1; margin: 0 0 12px;
  font-size: 22px; line-height: 1.15; font-weight: var(--fw-heading);
  letter-spacing: -0.035em; color: #fff;
}
.mega-col__hero p {
  position: relative; z-index: 1; margin: 0 0 14px;
  font-size: 15px; line-height: 1.65; font-weight: 500; color: rgba(255, 255, 255, 0.86);
}
.mega-col__hero a.cta {
  position: relative; z-index: 1; margin-top: 4px;
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; padding: 0 16px; border-radius: 999px;
  background: #fff; color: var(--primary-dark);
  font-size: 15px; font-weight: var(--fw-title); text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.mega-col__hero a.cta:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18); }
.mega-col__hero a.cta:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.mega-col__hero a.cta svg {
  width: 16px; height: 16px; stroke: currentColor; fill: none;
  stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round;
}
.mega-footer {
  background: var(--light-bg);
  border-top: 1px solid rgba(var(--primary-rgb), 0.14);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.mega-footer__row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap;
  padding-block: 8px 12px;
  font-size: 15px; color: var(--muted); font-weight: var(--fw-ui);
}
.mega-footer__links { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.mega-footer a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px;
  border-radius: 999px; color: var(--dark); text-decoration: none; font-weight: var(--fw-title);
}
.mega-footer a:hover { background: var(--white); color: var(--primary); }
.mega-footer a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .mega-overlay, .mega-panel { transition: none; }
}

.site-footer { background: var(--dark); color: #f2f2f2; padding: var(--layout-section-y) 0 28px; }
.site-footer__inner { max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.site-footer__grid { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: var(--layout-gap); padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.site-footer__brand .logo { display: inline-flex; margin-bottom: 14px; min-height: 0; }
.site-footer__brand .logo__img { height: 30px; }
.site-footer__tagline { margin: 0; max-width: 280px; color: rgba(255, 255, 255, 0.58); font-size: 14px; line-height: 1.55; font-weight: 500; }
.site-footer__col h4 { margin: 0 0 16px; font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.06em; text-transform: uppercase; color: #fff; }
.site-footer__links { display: grid; gap: 10px; }
.site-footer__links a { color: rgba(255, 255, 255, 0.58); font-size: 14px; font-weight: var(--fw-ui); text-decoration: none; transition: color 0.2s ease; }
.site-footer__links a:hover { color: #fff; }
.site-footer__bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 24px; color: rgba(255, 255, 255, 0.5); font-size: 13px; font-weight: var(--fw-ui); }
.site-footer__bottom a { color: rgba(255, 255, 255, 0.58); text-decoration: none; }
.site-footer__bottom a:hover { color: #fff; }

@media (max-width: 1000px) {
  body.is-search-docked .site-header__inner {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 8px;
  }
  body.is-search-docked .site-header__inner > .logo { grid-column: 1; grid-row: 1; }
  body.is-search-docked .site-header__nav { grid-column: 2; grid-row: 1; justify-self: end; }
  body.is-search-docked .site-header__search {
    grid-column: 1 / -1;
    grid-row: 2;
    max-height: 64px;
  }
  .search-block--header { width: min(100%, 700px); }
}
@media (max-width: 1100px) {
  .mega-cats__row { grid-template-columns: repeat(4, minmax(112px, 1fr)); }
}
@media (max-width: 960px) {
  .site-header__inner { padding: 20px var(--layout-gutter); column-gap: 10px; }
  body.is-search-docked .site-header__inner { padding: 10px var(--layout-gutter); column-gap: 8px; }
  .burger-btn__label { display: none; }
  .burger-btn { min-width: 0; width: 44px; padding: 0; }
  .mega-panel > .mega-sheet { padding-top: 22px; }
  .mega-cats { position: static; }
  .mega-cats__row { grid-template-columns: repeat(4, minmax(112px, 1fr)); }
  .mega-cat__icon, .mega-cat__icon img { width: 56px; height: 56px; }
  .mega-grid { grid-template-columns: 1fr 1fr; gap: 22px 28px; }
  .mega-col__hero {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 24px; align-items: center;
  }
  .mega-kicker, .mega-col__hero h4, .mega-col__hero p { grid-column: 1; }
  .mega-col__hero p { margin-bottom: 0; }
  .mega-col__hero a.cta { grid-column: 2; grid-row: 1 / span 3; margin-top: 0; }
  .site-footer { padding-block: clamp(36px, 6vw, 44px) 24px; }
  .site-footer__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .site-footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  body.is-search-docked .site-header__search { max-height: 108px; }
  .search-block--header, .search-block--header .search-shell { width: 100%; }
  .search-block--header .search-shell {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr) 37px;
    grid-template-rows: 37px 37px;
    min-height: 0;
    row-gap: 0;
  }
  .search-block--header .search-field[data-intent-dropdown="audience"] { grid-column: 1; grid-row: 1; border-left: 0; }
  .search-block--header .search-field[data-intent-dropdown="format"] { grid-column: 2; grid-row: 1; }
  .search-block--header .search-field[data-combo="sport"] { grid-column: 1; grid-row: 2; border-left: 0; border-top: 1px solid var(--line); }
  .search-block--header .search-field[data-combo="location"] { grid-column: 2; grid-row: 2; border-top: 1px solid var(--line); }
  .search-block--header .search-submit { grid-column: 3; grid-row: 1 / span 2; align-self: center; }
}
@media (max-width: 767px) {
  .site-header__inner,
  body.is-search-docked .site-header__inner {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
  .site-header__nav,
  body.is-search-docked .site-header__nav {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }
  .site-header__search,
  body.is-search-docked .site-header__search { display: none; }
  .account-face { max-width: 44px; padding-right: 0; }
  .account-face__nick { display: none; }
}
@media (max-width: 560px) {
  .mega-cats__row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .mega-cat { max-width: none; padding-inline: 6px; }
}
@media (max-width: 360px) {
  .mega-cats__row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mega-cat { padding-inline: 8px; }
}
@media (max-width: 620px) {
  .search-block--header .search-field { padding-inline: 7px; }
  .logo__img, .site-header .logo__img { height: 22px; }
  .site-footer__brand .logo__img { height: 26px; }
  .mega-grid { grid-template-columns: 1fr; }
  .mega-col__hero { display: flex; flex-direction: column; align-items: flex-start; }
  .mega-kicker, .mega-col__hero h4, .mega-col__hero p, .mega-col__hero a.cta { grid-column: auto; grid-row: auto; }
  .mega-col__hero p { margin-bottom: 16px; }
  .mega-col__hero a.cta { margin-top: 0; }
  .mega-footer__row { align-items: flex-start; }
  .mega-footer__links { display: grid; width: 100%; gap: 0; }
  .site-footer__grid { grid-template-columns: 1fr; }
  .site-footer__bottom { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 480px) {
  .site-header__nav,
  body.is-search-docked .site-header__nav { gap: 0; }
  .site-header .icon-btn--help { display: none; }
}
@media (max-width: 359px) {
  .logo__img, .site-header .logo__img { height: 15px; }
  .site-footer__brand .logo__img { height: 26px; }
}
`;

function ChromeStyles() {
  return <style data-trenio-chrome dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />;
}

export function Logo({ className }: { className?: string }) {
  const frame = { width: 503, height: 128, alt: "", decoding: "async" as const };
  return (
    <Link to="/" className={className ?? "logo"} aria-label="trenio.by">
      <img {...frame} className="logo__img logo__img--color" src="/logo.webp" />
      <img {...frame} className="logo__img logo__img--on-dark" src="/logo-on-dark.webp" />
      <img {...frame} className="logo__img logo__img--knockout" src="/logo-knockout.webp" />
    </Link>
  );
}

type AccountMenuTo = "/account/messages" | "/account/reviews" | "/account/bookings" | "/account/favorites" | "/account/settings";
type AdminMenuTo = "/admin" | "/admin/trainers" | "/admin/reviews" | "/admin/messages" | "/admin/accounts" | "/admin/finance" | "/admin/settings";
type MeMenuTo = "/me" | "/me/messages" | "/me/reviews" | "/me/favorites" | "/me/profile" | "/me/settings";

type HeaderMenuItem =
  | { id: string; label: string; kind: "account"; to: AccountMenuTo }
  | { id: string; label: string; kind: "admin"; to: AdminMenuTo }
  | { id: string; label: string; kind: "me"; to: MeMenuTo };

const ACCOUNT_MENU: HeaderMenuItem[] = [
  { id: "messages", label: "Сообщения", kind: "account", to: "/account/messages" },
  { id: "reviews", label: "Мои отзывы", kind: "account", to: "/account/reviews" },
  { id: "bookings", label: "Мои записи", kind: "account", to: "/account/bookings" },
  { id: "favorites", label: "Избранное", kind: "account", to: "/account/favorites" },
  { id: "settings", label: "Настройки", kind: "account", to: "/account/settings" },
];

const TRAINER_MENU: HeaderMenuItem[] = [
  { id: "overview", label: "Обзор", kind: "me", to: "/me" },
  { id: "messages", label: "Сообщения", kind: "me", to: "/me/messages" },
  { id: "profile", label: "Профиль", kind: "me", to: "/me/profile" },
  { id: "reviews", label: "Отзывы", kind: "me", to: "/me/reviews" },
  { id: "favorites", label: "Избранное", kind: "me", to: "/me/favorites" },
  { id: "settings", label: "Настройки", kind: "me", to: "/me/settings" },
];

const ADMIN_MENU: HeaderMenuItem[] = [
  { id: "overview", label: "Обзор", kind: "admin", to: "/admin" },
  { id: "trainers", label: "Тренеры", kind: "admin", to: "/admin/trainers" },
  { id: "reviews", label: "Отзывы", kind: "admin", to: "/admin/reviews" },
  { id: "messages", label: "Сообщения", kind: "admin", to: "/admin/messages" },
  { id: "accounts", label: "Аккаунты", kind: "admin", to: "/admin/accounts" },
  { id: "finance", label: "Бухгалтерия", kind: "admin", to: "/admin/finance" },
  { id: "settings", label: "Настройки", kind: "admin", to: "/admin/settings" },
];

function headerMenuFor(roles: UserRole[]): HeaderMenuItem[] {
  if (isStaff(roles)) return ADMIN_MENU;
  if (hasAnyRole(roles, ["trainer", "club"])) return TRAINER_MENU;
  return ACCOUNT_MENU;
}

function MenuCount({ count }: { count?: number }) {
  if (typeof count !== "number") return null;
  return <span className={`account-menu__count${count > 0 ? " is-hot" : ""}`}>{count > 99 ? "99+" : count}</span>;
}

function menuCounts(roles: UserRole[], own: number, inbox: number, favorites: number | undefined): Record<string, number | undefined> {
  if (isStaff(roles)) return {};
  if (hasAnyRole(roles, ["trainer", "club"])) return { messages: inbox, favorites };
  return { messages: own, bookings: 0, favorites };
}

function HeaderMenuLink({ item, count, onNavigate }: { item: HeaderMenuItem; count?: number; onNavigate: () => void }) {
  const props = { className: "account-menu__item", onClick: onNavigate };
  const body = <><span>{item.label}</span><MenuCount count={count} /></>;
  if (item.kind === "me") {
    return <Link to={item.to} activeOptions={item.to === "/me" ? { exact: true } : undefined} {...props}>{body}</Link>;
  }
  if (item.kind === "admin") {
    return <Link to={item.to} {...props}>{body}</Link>;
  }
  return <Link to={item.to} {...props}>{body}</Link>;
}

function AccountButton() {
  const { user } = useRouteContext({ from: "__root__" });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const pointerType = useRef("mouse");
  const holdClosed = useRef(false);
  const logout = useAuthServerFn(logoutFn);
  const messaging = useMessaging();
  const { keys, ready } = useFavorites();

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      holdClosed.current = true;
      setOpen(false);
      rootRef.current?.querySelector("a")?.focus();
      window.setTimeout(() => {
        holdClosed.current = false;
      }, 0);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!user) {
    return (
      <Link to="/auth/login" className="icon-btn" aria-label="Войти" title="Войти">
        <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
      </Link>
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const items = headerMenuFor(user.roles);
  const counts = menuCounts(user.roles, messaging.own, messaging.inbox, ready ? keys.length : undefined);
  const show = () => {
    if (holdClosed.current) return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  return (
    <div
      className={`account-menu${open ? " is-open" : ""}`}
      ref={rootRef}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") show();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        const active = document.activeElement;
        if (active && rootRef.current?.contains(active)) return;
        hideSoon();
      }}
      onFocus={() => {
        if (window.matchMedia("(hover: hover)").matches) show();
      }}
      onBlur={(event) => {
        if (!window.matchMedia("(hover: hover)").matches) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideSoon();
      }}
    >
      <Link
        to={getCabinetPath(user.roles)}
        activeOptions={{ exact: true }}
        className="account-face"
        aria-label={user.nick ? `${name}, ${user.nick}, вы вошли` : `${name}, вы вошли`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        title={user.nick || name}
        onPointerDown={(event) => {
          if (pointerType.current === "touch" && event.pointerType === "mouse") return;
          pointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          const touch = pointerType.current !== "mouse" || window.matchMedia("(hover: none)").matches;
          if (!touch) return;
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        <UserAvatar name={name} src={user.avatarPath} size={32} />
        {user.nick ? <span className="account-face__nick">{user.nick}</span> : null}
      </Link>
      <nav className="account-menu__panel" id="account-menu" aria-label="Кабинет">
        <div className="account-menu__card">
          {items.map((item) => <HeaderMenuLink key={item.id} item={item} count={counts[item.id]} onNavigate={() => setOpen(false)} />)}
          <div className="account-menu__rule" />
          <button
            type="button"
            className="account-menu__item account-menu__logout"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void logout()
                .then(() => {
                  window.location.href = "/auth/login";
                })
                .finally(() => setPending(false));
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M14 6l-6 6 6 6"/><path d="M8 12h7"/></svg>
            {pending ? "Выход…" : "Выйти"}
          </button>
        </div>
      </nav>
    </div>
  );
}

const MEGA_CATEGORIES = listPublishedSportCategories();

function MegaPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function MegaMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useRouteContext({ from: "__root__" });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={`mega-panel${open ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="mega-cats">
        <div className="mega-sheet">
          <ul className="mega-cats__row">
            {MEGA_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link className="mega-cat" to="/categories/$slug" params={{ slug: category.slug }} onClick={onClose}>
                  <span className="mega-cat__icon" aria-hidden="true">
                    {category.featuredImage ? (
                      <img src={category.featuredImage} alt="" width={64} height={64} />
                    ) : null}
                  </span>
                  <span className="mega-cat__label">{category.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mega-sheet">
        <div className="mega-grid">
          <div className="mega-col mega-col__hero">
            <span className="mega-kicker">Для тренеров</span>
            <h4>Стать тренером на trenio.by</h4>
            <p>Бесплатный профиль, заявки от клиентов и расписание — всё в одном месте.</p>
            <Link to="/join/trainer" className="cta" onClick={onClose}>
              Создать профиль
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6" /></svg>
            </Link>
          </div>
          <div className="mega-col">
            <h5>Города</h5>
            <ul>
              {BELARUS_OBLAST_CENTERS.map((city) => {
                const slug = cityCatalogSlug(city);
                return (
                  <li key={city}>
                    {slug ? (
                      <Link className="mega-link" to="/city/$slug" params={{ slug }} onClick={onClose}>
                        <span className="mega-mark"><MegaPin /></span>
                        <span>{city}</span>
                      </Link>
                    ) : (
                      <Link className="mega-link" to="/" onClick={onClose}>
                        <span className="mega-mark"><MegaPin /></span>
                        <span>{city}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mega-col">
            <h5>Клиентам</h5>
            <ul>
              <li><Link className="mega-link mega-link--text" to="/" onClick={onClose}>Найти тренера</Link></li>
              <li><Link className="mega-link mega-link--text" to="/map" search={{ sports: undefined, city: undefined }} onClick={onClose}>На карте</Link></li>
              <li><Link className="mega-link mega-link--text" to="/blog/$slug" params={{ slug: "kak-vybrat-trenera" }} onClick={onClose}>Как выбрать тренера</Link></li>
              <li><Link className="mega-link mega-link--text" to="/auth/signup" onClick={onClose}>Создать аккаунт</Link></li>
              {user ? (
                <li>
                  <Link className="mega-link mega-link--text" to={getCabinetPath(user.roles)} onClick={onClose}>
                    <TrainerName firstName={user.firstName} lastName={user.lastName} empty="Кабинет" />
                  </Link>
                </li>
              ) : (
                <li><Link className="mega-link mega-link--text" to="/auth/login" onClick={onClose}>Войти</Link></li>
              )}
            </ul>
          </div>
          <div className="mega-col">
            <h5>Тренерам</h5>
            <ul>
              <li><Link className="mega-link mega-link--text" to="/me" activeOptions={{ exact: true }} onClick={onClose}>Кабинет тренера</Link></li>
              <li><Link className="mega-link mega-link--text" to="/join/trainer" onClick={onClose}>Разместить профиль</Link></li>
              <li><Link className="mega-link mega-link--text" to="/" onClick={onClose}>Тарифы и продвижение</Link></li>
              <li><Link className="mega-link mega-link--text" to="/" onClick={onClose}>Помощь и FAQ</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mega-footer">
        <div className="mega-sheet mega-footer__row">
          <div className="mega-footer__links">
            <Link to="/" onClick={onClose}>О сервисе</Link>
            <Link to="/" onClick={onClose}>Контакты</Link>
            <Link to="/offer" onClick={onClose}>Договор оферты</Link>
            <Link to="/privacy" onClick={onClose}>Политика конфиденциальности</Link>
          </div>
          <span>© 2026 trenio.by</span>
        </div>
      </div>
    </div>
  );
}

function MapLink() {
  const onMap = useRouterState({ select: (state) => state.location.pathname === "/map" });
  return (
    <Link
      to="/map"
      search={{ sports: undefined, city: undefined }}
      className="icon-btn"
      aria-label="Карта тренеров"
      title="Карта тренеров"
      aria-current={onMap ? "page" : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.4" />
      </svg>
    </Link>
  );
}

function MessageCount() {
  const { user } = useRouteContext({ from: "__root__" });
  const messaging = useMessaging();
  if (!user) return null;
  const staff = hasAnyRole(user.roles, ["admin", "superadmin"]);
  const trainer = hasAnyRole(user.roles, ["trainer", "club"]);
  const label = `Сообщения, ${messaging.total}`;
  const className = `icon-btn favorite-count message-count${messaging.total > 0 ? " has-items" : ""}`;
  const icon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 6l8 6 8-6" /></svg>;
  const count = <span className="favorite-count__n">{messaging.total > 99 ? "99+" : messaging.total}</span>;
  if (staff && messaging.total === 0) {
    return <Link to="/admin/messages" className={className} aria-label={label} title="Сообщения">{icon}{count}</Link>;
  }
  if (trainer) {
    return <Link to="/me/messages" className={className} aria-label={label} title="Сообщения">{icon}{count}</Link>;
  }
  return <Link to="/account/messages" className={className} aria-label={label} title="Сообщения">{icon}{count}</Link>;
}

function FavoriteCount() {
  const { user } = useRouteContext({ from: "__root__" });
  const { keys, ready } = useFavorites();
  if (!user) return null;
  const count = keys.length;
  const label = ready
    ? `Избранное, ${count} ${pluralRu(count, "карточка", "карточки", "карточек")}`
    : "Избранное";
  const trainer = hasAnyRole(user.roles, ["trainer", "club"]) && !hasAnyRole(user.roles, ["admin", "superadmin"]);
  if (trainer) {
    return (
      <Link
        to="/me/favorites"
        className={`icon-btn favorite-count${ready && count > 0 ? " has-items" : ""}`}
        aria-label={label}
        title="Избранное"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" />
        </svg>
        {ready ? <span className="favorite-count__n">{count}</span> : null}
      </Link>
    );
  }
  return (
    <Link
      to="/account/favorites"
      className={`icon-btn favorite-count${ready && count > 0 ? " has-items" : ""}`}
      aria-label={label}
      title="Избранное"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" />
      </svg>
      {ready ? <span className="favorite-count__n">{count}</span> : null}
    </Link>
  );
}

export function SiteHeader({ middleSlot }: { middleSlot?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sentinel = document.getElementById("search-dock-sentinel");
    let observer: IntersectionObserver | null = null;

    const onScroll = () => {
      const scrolled = window.scrollY > 8;
      el.classList.toggle("is-scrolled", scrolled);
      if (!sentinel) document.body.classList.toggle("is-search-docked", scrolled);
    };

    if (sentinel) {
      observer = new IntersectionObserver(
        ([entry]) => {
          document.body.classList.toggle("is-search-docked", !entry.isIntersecting);
        },
        { root: null, rootMargin: `-${el.getBoundingClientRect().height}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(sentinel);
    }

    const syncHeaderHeight = () => {
      el.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    };
    syncHeaderHeight();
    const headerObserver = new ResizeObserver(syncHeaderHeight);
    headerObserver.observe(el);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      headerObserver.disconnect();
      if (!sentinel) document.body.classList.remove("is-search-docked");
    };
  }, []);

  return (
    <>
      <ChromeStyles />
      <div className={`mega-overlay${menuOpen ? " is-open" : ""}`} onClick={close} aria-hidden={!menuOpen} />
      <header className={`site-header${menuOpen ? " is-menu-open" : ""}`} id="site-header" ref={headerRef}>

        <div className="site-header__inner">
          <Logo />
          <div className="site-header__search">{middleSlot ?? <CatalogSearchForm variant="header" />}</div>
          <nav className="site-header__nav" aria-label="Основное меню">
            <Link to="/" className="icon-btn icon-btn--help" aria-label="Помощь" title="Помощь">?</Link>
            <MapLink />
            <MessageCount />
            <FavoriteCount />
            <AccountButton />
            <button
              ref={btnRef}
              type="button"
              className="icon-btn burger-btn"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="Открыть меню"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="burger-btn__bars" aria-hidden="true"><span/><span/><span/></span>
            </button>

          </nav>
        </div>
        <MegaMenu open={menuOpen} onClose={close} />
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <>
      <ChromeStyles />
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__grid">
            <div className="site-footer__brand">
              <Logo />
              <p className="site-footer__tagline">Поиск тренеров и спортивных занятий в Беларуси — индивидуально и в группе.</p>
            </div>
            <div className="site-footer__col">
              <h4>Поиск</h4>
              <div className="site-footer__links">
                <Link to="/">Тренеры</Link>
                <Link to="/map" search={{ sports: undefined, city: undefined }}>На карте</Link>
                <Link to="/clubs">Клубы</Link>
                <Link to="/categories/">Категории</Link>
              </div>
            </div>
            <div className="site-footer__col">
              <h4>Тренерам</h4>
              <div className="site-footer__links">
                <Link to="/join/trainer">Добавить профиль</Link>
                <Link to="/me" activeOptions={{ exact: true }}>Кабинет тренера</Link>
                <a href="#">Помощь</a>
              </div>
            </div>
            <div className="site-footer__col">
              <h4>Компания</h4>
              <div className="site-footer__links">
                <a href="#">О сервисе</a>
                <a href="#">Контакты</a>
                <Link to="/offer">Договор оферты</Link>
                <Link to="/privacy">Политика конфиденциальности</Link>
              </div>
            </div>
          </div>
          <div className="site-footer__bottom">
            <span>© 2026 trenio.by</span>
            <a href="mailto:hello@trenio.by">hello@trenio.by</a>
          </div>
        </div>
      </footer>
    </>
  );
}
