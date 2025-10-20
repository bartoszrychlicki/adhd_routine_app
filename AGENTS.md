# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router lives under `src/app`; `layout.tsx` defines shared chrome and `page.tsx` serves the home route.
- Keep global styles in `src/app/globals.css` and place static assets such as icons in `public/`.
- Store configuration files (`next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `postcss.config.mjs`) at the project root; add new config alongside them.
- Co-locate feature-specific components under `src/app/<feature>` so routing, assets, and logic remain predictable.

## Build, Test, and Development Commands
- `npm run dev`: start the Turbopack dev server at `http://localhost:3000`.
- `npm run build`: run before shipping to catch compile issues.
- `npm run start`: serve the production build locally.
- `npm run lint`: enforce lint rules and resolve warnings before merging.
- `npm run supabase:start`: boot the local Supabase stack (Postgres, Auth, Studio, Storage).
- `npm run supabase:stop`: stop the local Supabase containers when you're done.
- `npm run supabase:types`: regenerate TypeScript definitions from the local database schema.

## Coding Style & Naming Conventions
- Write components and utilities in TypeScript with strict typing and functional React components.
- Use PascalCase for component files (e.g., `HeroSection.tsx`) and camelCase for helpers.
- Prefer two-space indentation, keep files lean, and extract shared UI into `src/app/components/` when patterns emerge.
- Use Tailwind utility classes directly in JSX; reserve `globals.css` for resets and design tokens.
- Honor the ESLint ruleset defined in `eslint.config.mjs` and enable editor auto-fix-on-save.

## Testing Guidelines
- Automated tests are not yet wired up; when adding them, place specs under `src/__tests__` using the `*.spec.tsx` pattern and add a `test` script to `package.json`.
- Until automated coverage exists, rely on `npm run lint` and manual verification across multiple browsers.
- Aim for meaningful coverage on new components and document any known gaps in pull requests.

## Commits & Pull Request Guidelines
- Use the Conventional Commits strategy for commit messages.
- Keep commit subjects concise and imperative (e.g., `Add hero card layout`) to match project history.
- Group related changes to keep diffs reviewable and document PR intent, linked issues, and notable UI changes.
- Include before/after screenshots when visuals change and confirm `npm run lint` (and tests when available) before requesting review.

## Coding Practices

### Support Level

#### Expert
- Favor elegant, maintainable solutions over verbose code and assume familiarity with language idioms.
- Highlight performance implications and optimization opportunities in suggested code.
- Frame solutions within broader architectural contexts and propose alternatives when appropriate.
- Focus comments on intent rather than restating the code; rely on descriptive naming.
- Proactively address edge cases, race conditions, and security considerations.
- When debugging, provide targeted diagnostic approaches instead of broad guesswork.
- Recommend comprehensive testing strategies, covering mocking, organization, and expected coverage.

### Documentation

#### Swagger
- Define complete request and response schemas for every endpoint.
- Version API paths semantically to preserve backward compatibility.
- Document endpoints, parameters, and relevant domain-specific concepts with detailed descriptions.
- Configure security schemes to capture authentication and authorization requirements.
- Use tags to group endpoints by resource or functional area.
- Provide request and response examples for every endpoint to aid integrators.

## Frontend

### React

#### Next.js
- Use the App Router and Server Components to improve performance and SEO.
- Prefer route handlers over the legacy `pages/api` directory for API endpoints.
- Employ server actions for form handling and data mutations originating from Server Components.
- Leverage the Next.js `Image` component with proper sizing to optimize Core Web Vitals.
- Use the Metadata API for dynamic SEO configuration.
- Use React Server Components for data-fetching operations to reduce client-side JavaScript.
- Adopt Streaming and Suspense to deliver responsive loading states.
- Use the new `Link` component without wrapping it in a child `<a>` tag.
- Leverage parallel routes for complex layouts and orchestrated data fetching.
- Implement intercepting routes for modal patterns and nested UIs.

#### React Coding Standards
- Use functional components with hooks rather than class components.
- Wrap expensive components with `React.memo()` when they render with identical props.
- Apply `React.lazy()` and `Suspense` for code splitting and improved initial loads.
- Memoize event handlers passed to children with `useCallback` to avoid unnecessary renders.
- Cache expensive calculations with `useMemo` to prevent recomputation on every render.
- Generate accessible IDs with `useId()` when needed.
- Use the `use` hook for data fetching in React 19+ projects.
- Leverage Server Components for data-fetching-heavy experiences when working in Next.js or similar frameworks.
- Consider `useOptimistic` for optimistic UI updates in forms.
- Use `useTransition` for non-urgent state updates to keep the UI responsive.

#### React Router
- Prefer `createBrowserRouter` instead of `BrowserRouter` for richer data loading and error handling.
- Lazy-load route components with `React.lazy()` to improve initial load time.
- Use the `useNavigate` hook for programmatic navigation instead of component props.
- Handle data fetching and mutations at the route level via loader and action functions.
- Provide `errorElement` boundaries to gracefully handle routing and data errors.
- Use relative paths with dot notation (e.g., `../parent`) to preserve route hierarchy flexibility.
- Read parent route data via `useRouteLoaderData`.
- Use fetchers for non-navigation data mutations.
- Apply `route.lazy()` for route-level code splitting with automatic loading states.
- Control data revalidation with `shouldRevalidate` after navigation.
