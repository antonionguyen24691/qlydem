---
version: alpha
name: PMQL Operations Dashboard
description: Data-dense retail operations dashboard for sales, inventory, receivables, and cash flow.
colors:
  primary: "#0f6b61"
  primary-soft: "#e8f4f1"
  canvas: "#fafaf8"
  surface: "#ffffff"
  ink: "#18181b"
  muted: "#71717a"
  border: "#e4e4e7"
  positive: "#0f766e"
  warning: "#b45309"
  danger: "#b42318"
  danger-soft: "#fef2f2"
  blue: "#2563eb"
typography:
  page-title: { fontFamily: Geist Sans, fontSize: 28px, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.02em }
  section-title: { fontFamily: Geist Sans, fontSize: 16px, fontWeight: 700, lineHeight: 1.35 }
  metric: { fontFamily: Geist Sans, fontSize: 28px, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.02em }
  label: { fontFamily: Geist Sans, fontSize: 12px, fontWeight: 600, lineHeight: 1.35 }
  body: { fontFamily: Geist Sans, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
rounded: { control: 10px, card: 16px, pill: 9999px }
spacing: { xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, section: 32px }
components:
  dashboard-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: 8px 14px
  metric-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 16px
  chart-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 16px
---

# PMQL Operations Dashboard

## Overview

Dashboard is a role-aware retail control surface for store owners, accountants, sales staff, and warehouse operators. It prioritizes actions that prevent loss of cash, stock, or receivables. The default period is today; the user can choose 7 days, 30 days, current month, or a custom range.

## Colors

- Emerald is the only primary interaction color.
- Green means collected/healthy, amber means needs attention, and red means overdue, out of stock, or loss risk.
- Charts use emerald for revenue, blue for collections, and muted red for expenses; colors must never encode the only meaning.

## Typography

- Use Geist Sans already bundled by the app.
- Metrics use tabular figures where available. Labels stay short and sentence case.
- Use visible period labels near every chart to avoid ambiguous totals.

## Layout

- Container: maximum 1400px.
- Dashboard navigation is a horizontally scrollable tab row: Overview, Sales, Inventory, Receivables & Cash Flow.
- Desktop: a 12-column grid; mobile: one column and no nested vertical scrollers.
- Shared period selector sits above the tab content and changes every chart and KPI in the active tab.

## Elevation & Depth

- Use white surfaces, a 1px border, and restrained shadow only for cards.
- Group long operational lists with dividers rather than a card inside every row.

## Shapes

- Cards: 16px. Inputs and controls: 10px. Status chips and tabs: pill.

## Components

- **Period selector:** Today, 7 days, 30 days, this month, custom range.
- **Metric card:** Label, value, comparison/context, and one direct link to the filtered detail page.
- **Chart panel:** Title, period, legend, accessible text summary, and a clear click-through action.
- **Action queue:** Prioritized list for overdue promises, debt, low stock, and zero stock.
- **Dashboard tab:** Active tab has an emerald surface/treatment; tab row scrolls horizontally on smaller screens.

## Dashboard Configuration

| Tab | Primary charts | Key actions |
|---|---|---|
| Overview | Revenue vs collected; action queue | Open reports, orders, inventory, receivables |
| Sales | Revenue/collection/expense by day; top products; category contribution | Open filtered orders or product details |
| Inventory | Stock health split; low-stock list; inventory by category | Open inventory filtered to low/out-of-stock |
| Receivables & Cash Flow | Cash in/out by day; receivable exposure; overdue promises | Open finance receivables and cashbook |

## Do's and Don'ts

- Do make every metric and chart actionable with a destination.
- Do preserve finance permissions: unavailable financial data must not block inventory/sales users.
- Do show empty states instead of invented chart values.
- Do not use more than three series in one chart.
- Do not use nested scrolling tables or hidden chart controls.
- Do not duplicate full finance or inventory pages inside the dashboard; dashboard provides summary and drill-through only.
