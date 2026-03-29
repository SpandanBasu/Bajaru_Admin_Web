import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      <Sidebar />
      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
