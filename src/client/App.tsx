import { RouterProvider } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { createAppRouter } from "./router.js";

export function App({ queryClient }: { queryClient: QueryClient }) {
  const router = createAppRouter(queryClient);
  return <RouterProvider router={router} />;
}
