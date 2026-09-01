## PG Khata — Mobile App Experience Redesign

I want to improve the mobile/PWA experience of **PG Khata**.

The current application is responsive, but when installed as a PWA on a mobile device, it still feels like a website. The desktop-style sidebar/navigation is being adapted to mobile, instead of the application feeling like a purpose-built mobile app.

### Goal

Make the **installed mobile/PWA experience feel like a real mobile application**, while preserving the existing desktop experience.

The target is NOT simply:

> "Make the sidebar smaller or move the sidebar to the bottom."

The target is a proper **mobile application shell and navigation experience**.

---

# IMPORTANT: DO NOT MODIFY CODE YET

First, thoroughly understand the existing codebase.

Do not start implementing anything until you have completed the analysis below.

## 1. Understand the codebase

Inspect the relevant parts of the repository and identify:

* Framework and application structure
* Routing architecture
* Layout architecture
* Root layout/app shell
* Desktop sidebar implementation
* Header implementation
* Navigation configuration
* Mobile/responsive navigation
* Existing responsive breakpoints
* Reusable UI components
* Dashboard structure
* Authentication flow
* Any role/permission-based navigation
* PWA configuration
* `manifest`
* viewport configuration
* service worker/PWA implementation
* safe-area handling, if any
* existing mobile-specific components
* global CSS/Tailwind configuration
* design tokens/theme
* loading states
* modals/dialogs/drawers
* bottom sheets, if any
* page-level layouts
* route groups/layout groups
* any code that assumes the sidebar exists

Do not assume how anything works. Inspect the actual implementation.

---

# 2. Understand the current UX

Determine:

1. How desktop navigation currently works.
2. How mobile navigation currently works.
3. Which routes are exposed through the sidebar.
4. Which routes are most important for a PG/property-management user.
5. Which navigation items should remain permanently accessible on mobile.
6. Which items should move into a "More" menu.
7. Whether navigation is role-dependent.
8. Whether there are nested routes that require special handling.
9. Whether there are existing mobile UI patterns that should be reused.

Do not redesign the information architecture unnecessarily.

Preserve the existing product functionality unless there is a strong UX reason to change it.

---

# 3. Define the target mobile architecture

After understanding the codebase, propose a mobile application shell.

The general direction should be:

### Desktop

```text
┌────────────┬──────────────────────────┐
│            │                          │
│  Sidebar   │         Content          │
│            │                          │
│            │                          │
└────────────┴──────────────────────────┘
```

### Mobile/PWA

```text
┌──────────────────────────────┐
│        Mobile Header         │
├──────────────────────────────┤
│                              │
│                              │
│          Content             │
│                              │
│                              │
│                              │
├──────────────────────────────┤
│ Home │ ... │ ... │ ... │ More│
└──────────────────────────────┘
```

However, **do not blindly copy this structure**.

Inspect PG Khata's actual features and determine the best navigation hierarchy.

The mobile navigation should generally contain only the most important destinations, with secondary functionality accessible through a More/menu interface.

---

# 4. Mobile should be a dedicated experience

Do NOT simply make the desktop layout responsive.

Instead, determine whether the codebase should use a dedicated mobile shell such as:

```text
App
├── DesktopShell
│   ├── Sidebar
│   ├── DesktopHeader
│   └── Content
│
└── MobileShell
    ├── MobileHeader
    ├── Content
    └── BottomNavigation
```

Use the existing architecture where practical, but don't preserve a poor architecture merely for convenience.

The desktop experience must remain intact.

---

# 5. Mobile UX requirements

The new mobile experience should consider:

### Navigation

* Fixed bottom navigation
* 4–5 primary destinations maximum
* Clear active state
* Proper route state synchronization
* Correct behavior with nested routes
* More menu/drawer for secondary navigation
* No desktop sidebar visible on mobile

### Touch interaction

* Touch-friendly controls
* Appropriate minimum tap targets
* Comfortable spacing
* No tiny desktop controls
* No accidental taps

### Layout

* Full-width mobile content
* Mobile-appropriate padding
* No unnecessary desktop containers
* No excessive empty margins
* Proper scrolling behavior
* Fixed navigation should not cover page content

### Safe areas

Support mobile safe-area insets, especially for devices with gesture navigation/home indicators.

Consider:

```css
env(safe-area-inset-bottom)
```

where appropriate.

### Header

Evaluate whether the existing desktop header should become a dedicated mobile header.

The mobile header should be simpler and optimized for:

* page title
* back navigation where required
* search/actions where necessary
* profile/menu actions where appropriate

Do not automatically duplicate the desktop header.

### PWA

Inspect and improve the PWA-specific experience where necessary:

* viewport
* display mode
* theme color
* status bar behavior
* safe areas
* standalone mode
* mobile browser/PWA differences

Do not change PWA configuration unless it is actually relevant.

---

# 6. Visual direction

PG Khata should feel like a **modern SaaS/mobile finance/property-management app**, not a website squeezed into a phone.

Prioritize:

* clean hierarchy
* compact but comfortable spacing
* strong readability
* consistent typography
* clear navigation
* subtle borders
* appropriate elevation
* consistent iconography
* predictable interaction patterns
* minimal visual noise

Do not introduce an entirely new design system unless necessary.

Reuse the existing PG Khata branding, colors, typography, components, and design tokens where appropriate.

---

# 7. Responsive behavior

Define clear behavior for:

### Mobile

Approximately:

```text
< 768px
```

### Tablet

```text
768px – 1023px
```

### Desktop

```text
>= 1024px
```

But first inspect the existing project's breakpoints and follow them if they are already well-defined.

Do not arbitrarily introduce new breakpoints.

---

# 8. Important constraints

Do NOT:

* rewrite the entire application
* unnecessarily rewrite working components
* break existing routes
* remove existing functionality
* duplicate business logic
* create unnecessary abstractions
* change the backend
* change database schemas
* change authentication
* change APIs unless absolutely necessary
* modify desktop UX unnecessarily
* create a completely separate application
* add unnecessary dependencies

Prefer small, maintainable changes that integrate with the existing architecture.

---

# 9. Before implementation

After inspecting the repository, give me:

### A. Current architecture

Explain briefly:

* current shell
* routing
* navigation
* responsive strategy
* PWA setup

### B. Problems found

List the specific reasons the current mobile experience feels like a website.

### C. Proposed mobile architecture

Show the proposed component/layout structure.

For example:

```text
MobileShell
├── MobileHeader
├── MobileContent
└── MobileBottomNav
    ├── Home
    ├── Properties
    ├── Tenants
    ├── Payments
    └── More
```

But choose the actual structure based on the codebase.

### D. Route/navigation mapping

Create a table:

| Existing route | Mobile destination | Primary/Secondary | Reason |
| -------------- | ------------------ | ----------------- | ------ |

### E. Files to modify

List the exact files/components you expect to change and why.

### F. Implementation plan

Give me a step-by-step implementation plan in the correct order.

### G. Risks

Identify anything that could break:

* routing
* authentication
* responsive behavior
* desktop layout
* PWA behavior
* scroll behavior
* nested routes
* role-based navigation

---

# Final instruction

**Do not write or modify code yet.**

First inspect the repository thoroughly and give me the analysis and implementation plan.

After I review the plan, we will implement it incrementally.

Do not make assumptions about the codebase. Base your recommendations on the actual files and architecture you find.
