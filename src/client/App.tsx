import { RouterProvider } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppAccessGate } from "./components/auth/AppAccessGate.js";
import { DesktopBootstrap } from "./components/bootstrap/DesktopBootstrap.js";
import { createAppRouter } from "./router.js";

export function App({ queryClient }: { queryClient: QueryClient }) {
  const [router] = useState(() => createAppRouter(queryClient));
  return (
    <DesktopBootstrap>
      <AppAccessGate>
        <RouterProvider router={router} />
      </AppAccessGate>
    </DesktopBootstrap>
  );
}
