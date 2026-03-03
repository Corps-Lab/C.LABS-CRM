import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AgencyMode = "shared" | "isolated";

export interface AgencyTheme {
  primary: string;
  accent?: string;
  chartStart?: string;
  chartEnd?: string;
  glow?: string;
}

export interface AgencyConfig {
  id: string;
  name: string;
  description?: string;
  mode: AgencyMode;
  theme: AgencyTheme;
}

interface AgencyContextType {
  agencies: AgencyConfig[];
  currentAgency: AgencyConfig;
  switchAgency: (id: string) => void;
  isIsolated: boolean;
}

const LEGACY_AGENCY_ALIASES: Record<string, string> = {
  sky: "corps",
};

const LEGACY_STORAGE_MIGRATIONS = [
  ["crm_sky_users", "crm_corps_users"],
  ["crm_sky_session", "crm_corps_session"],
  ["crm_sky_clients", "crm_corps_clients"],
  ["crm_sky_demands", "crm_corps_demands"],
] as const;

const agencies: AgencyConfig[] = [
  {
    id: "clabs",
    name: "C.LABS",
    mode: "shared",
    description: "Acesso padrão do CRM C.LABS",
    theme: {
      primary: "72 90% 53%",
      accent: "72 90% 53%",
      chartStart: "72 90% 53%",
      chartEnd: "72 90% 45%",
      glow: "72 90% 53% / 0.20",
    },
  },
  {
    id: "corps",
    name: "Agência Corps",
    description: "Acesso isolado da Agência Corps com paleta azul e dados separados",
    mode: "isolated",
    theme: {
      primary: "199 92% 60%",
      accent: "199 92% 60%",
      chartStart: "199 92% 60%",
      chartEnd: "199 90% 52%",
      glow: "199 92% 60% / 0.25",
    },
  },
];

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

const STORAGE_KEY = "crm_current_agency";

function normalizeAgencyId(id: string | null | undefined) {
  if (!id) return null;
  return LEGACY_AGENCY_ALIASES[id] || id;
}

function migrateLegacyAgencyStorage() {
  for (const [oldKey, newKey] of LEGACY_STORAGE_MIGRATIONS) {
    const legacyValue = localStorage.getItem(oldKey);
    const nextValue = localStorage.getItem(newKey);
    if (legacyValue && !nextValue) {
      localStorage.setItem(newKey, legacyValue);
    }
  }

  const storedAgency = localStorage.getItem(STORAGE_KEY);
  if (storedAgency === "sky") {
    localStorage.setItem(STORAGE_KEY, "corps");
  }
}

function applyTheme(config: AgencyConfig) {
  const root = document.documentElement;
  root.dataset.agency = config.id;
  root.style.setProperty("--primary", config.theme.primary);
  if (config.theme.accent) root.style.setProperty("--accent", config.theme.accent);
  if (config.theme.chartStart) root.style.setProperty("--chart-primary", config.theme.chartStart);
  if (config.theme.chartStart) root.style.setProperty("--chart-gradient-start", config.theme.chartStart);
  if (config.theme.chartEnd) root.style.setProperty("--chart-gradient-end", config.theme.chartEnd);
  if (config.theme.glow) root.style.setProperty("--glow-primary", config.theme.glow);
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string>(() => {
    migrateLegacyAgencyStorage();
    const params = new URLSearchParams(window.location.search);
    const paramAgency = normalizeAgencyId(params.get("agency"));
    if (paramAgency && agencies.some((a) => a.id === paramAgency)) return paramAgency;
    const stored = normalizeAgencyId(localStorage.getItem(STORAGE_KEY));
    return stored && agencies.some((a) => a.id === stored) ? stored : agencies[0].id;
  });

  const currentAgency = useMemo(
    () => agencies.find((a) => a.id === currentId) || agencies[0],
    [currentId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentAgency.id);
    applyTheme(currentAgency);
  }, [currentAgency]);

  const switchAgency = (id: string) => {
    if (agencies.some((a) => a.id === id)) {
      setCurrentId(id);
    }
  };

  return (
    <AgencyContext.Provider
      value={{
        agencies,
        currentAgency,
        switchAgency,
        isIsolated: currentAgency.mode === "isolated",
      }}
    >
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error("useAgency must be used within an AgencyProvider");
  return ctx;
}
