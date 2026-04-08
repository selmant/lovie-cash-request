import { createBrowserRouter, RouterProvider } from "react-router";

const router = createBrowserRouter([
  {
    path: "/login",
    lazy: () => import("./routes/auth/AuthPage"),
  },
  {
    path: "/r/:token",
    lazy: () => import("./routes/request-detail/ShareRoute"),
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
