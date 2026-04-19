import { RouterProvider } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { DesktopBootstrap } from "./components/bootstrap/DesktopBootstrap.js";
import { createAppRouter } from "./router.js";

export function App({ queryClient }: { queryClient: QueryClient }) {
  const router = createAppRouter(queryClient);
  return (
    <DesktopBootstrap>
      <RouterProvider router={router} />
    </DesktopBootstrap>
  );
}
