import { createContext, useContext, useState, ReactNode } from "react";
import { useExtensionBridge } from "@/hooks/use-extension-bridge";
import type { RichLogEntry } from "@/lib/mock-traffic";

interface GlobalState {
  totalScans: number;
  threatsBlocked: number;
  recentLogs: RichLogEntry[];
}

interface ExtensionContextValue {
  state: GlobalState;
  connected: boolean;
}

const ExtensionContext = createContext<ExtensionContextValue | null>(null);

export function ExtensionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalState>({
    totalScans: 0,
    threatsBlocked: 0,
    recentLogs: [],
  });

  const { extensionConnected } = useExtensionBridge((updates: Partial<GlobalState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  });

  return (
    <ExtensionContext.Provider value={{ state, connected: extensionConnected }}>
      {children}
    </ExtensionContext.Provider>
  );
}

export function useExtensionData() {
  const ctx = useContext(ExtensionContext);
  if (!ctx) throw new Error("useExtensionData must be used within ExtensionProvider");
  return ctx;
}
