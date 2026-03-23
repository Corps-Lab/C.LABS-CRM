export type ClientStatus = "ativo" | "prospect" | "inativo" | "inadimplente";

export interface Client {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  valorPago: number;
  recorrencia: "mensal" | "trimestral" | "semestral" | "anual";
  status: ClientStatus;
  responsavel: string;
  contatoInterno: string;
  createdAt: Date;
}

export type ClientFormData = Omit<Client, "id" | "createdAt">;

export const recorrenciaOptions = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;

export const clientStatusOptions = [
  { value: "ativo", label: "Ativo" },
  { value: "prospect", label: "Prospect" },
  { value: "inativo", label: "Inativo" },
  { value: "inadimplente", label: "Inadimplente" },
] as const;

export function isClientStatus(value: string | null | undefined): value is ClientStatus {
  return value === "ativo" || value === "prospect" || value === "inativo" || value === "inadimplente";
}

export function inferLegacyClientStatus(cnpj: string, valorPago: number): ClientStatus {
  if (!cnpj || cnpj.trim().length < 5) return "prospect";
  if (Number(valorPago) <= 0) return "inativo";
  return "ativo";
}

export function normalizeClientStatus(
  value: string | null | undefined,
  cnpj: string,
  valorPago: number
): ClientStatus {
  if (isClientStatus(value)) {
    return value;
  }
  // Compat with old labels used before explicit status field existed.
  if (value === "prospecto" || value === "prospectos") return "prospect";
  if (value === "inativos") return "inativo";
  if (value === "ativos") return "ativo";
  return inferLegacyClientStatus(cnpj, valorPago);
}
