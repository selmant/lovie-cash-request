import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { AuthLayout } from "@/routes/auth/AuthLayout";
import { Header } from "@/components/Header";
import { Toaster } from "sonner";

function RootLayout() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    lazy: () => import("./routes/auth/AuthPage"),
  },
  {
    path: "/r/:token",
    lazy: () => import("./routes/request-detail/ShareRoute"),
  },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RootLayout />,
        children: [
          {
            index: true,
            lazy: () => import("./routes/dashboard/DashboardPage"),
          },
          {
            path: "new",
            lazy: () => import("./routes/new-request/NewRequestPage"),
          },
          {
            path: "requests/:id",
            lazy: () => import("./routes/request-detail/RequestDetailPage"),
          },
        ],
      },
    ],
  },
]);

export function App() {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
}
