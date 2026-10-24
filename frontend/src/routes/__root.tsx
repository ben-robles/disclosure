import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/disclosure/AppShell";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const primaryLink =
  "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90";

function NotFoundComponent() {
  return (
    <AppShell
      title="We can't find that page"
      lead="The link may be old, or the address may have a typo."
    >
      <Link to="/" className={primaryLink}>
        Go to the start
      </Link>
    </AppShell>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <AppShell
      title="Something went wrong"
      lead="This page didn't load. Try again, or start over from the home page."
    >
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className={primaryLink}
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex h-11 items-center rounded-lg border px-5 font-semibold hover:bg-accent"
        >
          Go to the start
        </a>
      </div>
    </AppShell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Disclosure" },
      { name: "description", content: "Seller-side home defect documentation" },
      { property: "og:title", content: "Disclosure" },
      { property: "og:description", content: "Seller-side home defect documentation" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400..800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
