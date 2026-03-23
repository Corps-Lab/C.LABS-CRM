import { z } from "zod";

// CNPJ validation helper
const formatCNPJ = (cnpj: string) => {
  return cnpj.replace(/\D/g, "");
};

const validateCNPJ = (cnpj: string) => {
  const cleaned = formatCNPJ(cnpj);
  if (cleaned.length !== 14) return false;
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  return true;
};

export const clientSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(3, "Razão Social deve ter no mínimo 3 caracteres")
    .max(200, "Razão Social deve ter no máximo 200 caracteres"),
  nomeFantasia: z
    .string()
    .trim()
    .max(200, "Nome Fantasia deve ter no máximo 200 caracteres")
    .optional()
    .default(""),
  cnpj: z
    .string()
    .trim()
    .refine((val) => validateCNPJ(val), "CNPJ inválido"),
  endereco: z
    .string()
    .trim()
    .min(10, "Endereço deve ter no mínimo 10 caracteres")
    .max(300, "Endereço deve ter no máximo 300 caracteres"),
  valorPago: z
    .number({ invalid_type_error: "Valor deve ser um número" })
    .min(0, "Valor não pode ser negativo")
    .max(10000000, "Valor muito alto"),
  recorrencia: z.enum(["mensal", "trimestral", "semestral", "anual"], {
    errorMap: () => ({ message: "Selecione uma recorrência válida" }),
  }),
  status: z.enum(["ativo", "prospect", "inativo", "inadimplente"], {
    errorMap: () => ({ message: "Selecione um status válido" }),
  }),
  responsavel: z
    .string()
    .trim()
    .min(3, "Nome do responsável deve ter no mínimo 3 caracteres")
    .max(100, "Nome do responsável deve ter no máximo 100 caracteres"),
  contatoInterno: z
    .string()
    .trim()
    .min(8, "Contato deve ter no mínimo 8 caracteres")
    .max(50, "Contato deve ter no máximo 50 caracteres"),
});

export type ClientSchemaType = z.infer<typeof clientSchema>;
