import './libs/firebase'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import AppRouter from "./router/router";
import { HeroUIProvider } from "@heroui/react";
import {ToastProvider} from "@heroui/toast";
import { Provider } from "react-redux";
import store from "./store/store";
import { ThemeProvider as NextThemesProvider } from "next-themes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="dark">
        <ToastProvider />
        <Provider store={store}>
          <main className="h-screen dark text-foreground bg-background overflow-x-hidden overflow-y-hidden">
            <AppRouter />
          </main>
        </Provider>
      </NextThemesProvider>
    </HeroUIProvider>
  </StrictMode>,
);
