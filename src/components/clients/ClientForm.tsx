import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, ClientSchemaType } from "@/lib/validations";
import { clientStatusOptions, recorrenciaOptions } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClientSchemaType) => void;
  defaultValues?: ClientSchemaType;
  isEdit?: boolean;
}

interface CnpjApiResponse {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
}

export function ClientForm({
  open,
  onClose,
  onSubmit,
  defaultValues,
  isEdit = false,
}: ClientFormProps) {
  const { toast } = useToast();
  const [isLookingUpCnpj, setIsLookingUpCnpj] = useState(false);
  const [lastLookupCnpj, setLastLookupCnpj] = useState("");
  const lookupTimeoutRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientSchemaType>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValues || {
      razaoSocial: "",
      cnpj: "",
      endereco: "",
      valorPago: 0,
      recorrencia: "mensal",
      status: "ativo",
      responsavel: "",
      contatoInterno: "",
    },
  });

  const handleFormSubmit = (data: ClientSchemaType) => {
    onSubmit(data);
    toast({
      title: isEdit ? "Cliente atualizado!" : "Cliente cadastrado!",
      description: `${data.razaoSocial} foi ${isEdit ? "atualizado" : "adicionado"} com sucesso.`,
    });
    reset();
    onClose();
  };

  const cnpjField = register("cnpj");

  const onlyDigits = (value: string) => value.replace(/\D/g, "");

  const formatCNPJ = (value: string) => {
    const cleaned = onlyDigits(value).slice(0, 14);
    return cleaned
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const buildAddress = (data: CnpjApiResponse) => {
    const street = [data.descricao_tipo_de_logradouro, data.logradouro]
      .filter(Boolean)
      .join(" ");
    const firstPart = [street, data.numero, data.complemento].filter(Boolean).join(", ");
    const secondPart = [data.bairro, data.municipio, data.uf].filter(Boolean).join(" - ");
    const cepPart = data.cep ? `CEP ${data.cep}` : "";
    return [firstPart, secondPart, cepPart].filter(Boolean).join(" | ");
  };

  const clearLookupTimeout = () => {
    if (lookupTimeoutRef.current) {
      window.clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = null;
    }
  };

  const lookupCnpj = async (cnpjInput: string) => {
    const cnpj = onlyDigits(cnpjInput);
    if (cnpj.length !== 14 || cnpj === lastLookupCnpj || isLookingUpCnpj) return;

    setIsLookingUpCnpj(true);
    try {
      const endpoints = [
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)}`,
      ];
      let data: CnpjApiResponse | null = null;
      let lastError: Error | null = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) throw new Error("Falha na consulta de CNPJ");
          data = (await response.json()) as CnpjApiResponse;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error("Falha na consulta");
        }
      }

      if (!data) throw lastError || new Error("Não foi possível consultar o CNPJ");
      const razaoSocial = data.razao_social || data.nome_fantasia || "";
      const endereco = buildAddress(data);
      const phone = data.ddd_telefone_1 || "";

      if (razaoSocial) {
        setValue("razaoSocial", razaoSocial, { shouldDirty: true, shouldValidate: true });
      }
      if (endereco) {
        setValue("endereco", endereco, { shouldDirty: true, shouldValidate: true });
      }
      if (phone && !getValues("contatoInterno")) {
        setValue("contatoInterno", phone, { shouldDirty: true, shouldValidate: true });
      }

      setLastLookupCnpj(cnpj);
      toast({
        title: "Dados preenchidos",
        description: "Razão social e endereço foram carregados pelo CNPJ.",
      });
    } catch {
      toast({
        title: "CNPJ não encontrado",
        description: "Não conseguimos buscar os dados automaticamente. Preencha manualmente.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUpCnpj(false);
    }
  };

  const scheduleLookup = (cnpjInput: string) => {
    clearLookupTimeout();
    lookupTimeoutRef.current = window.setTimeout(() => {
      void lookupCnpj(cnpjInput);
    }, 450);
  };

  useEffect(() => {
    if (!open) {
      clearLookupTimeout();
      setIsLookingUpCnpj(false);
      setLastLookupCnpj("");
    }
  }, [open]);

  useEffect(() => {
    return () => clearLookupTimeout();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {isEdit ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Razão Social */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="razaoSocial">Razão Social *</Label>
              <Input
                id="razaoSocial"
                placeholder="Nome da empresa"
                {...register("razaoSocial")}
                className="bg-secondary border-border"
              />
              {errors.razaoSocial && (
                <p className="text-sm text-destructive">{errors.razaoSocial.message}</p>
              )}
            </div>

            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                {...cnpjField}
                onChange={(e) => {
                  const formatted = formatCNPJ(e.target.value);
                  setValue("cnpj", formatted, { shouldDirty: true, shouldValidate: true });
                  const digits = onlyDigits(formatted);
                  if (digits.length === 14) {
                    scheduleLookup(formatted);
                  }
                }}
                onBlur={(e) => {
                  cnpjField.onBlur(e);
                  clearLookupTimeout();
                  void lookupCnpj(e.target.value);
                }}
                className="bg-secondary border-border"
              />
              {isLookingUpCnpj && (
                <p className="text-xs text-muted-foreground">Buscando dados do CNPJ...</p>
              )}
              {errors.cnpj && (
                <p className="text-sm text-destructive">{errors.cnpj.message}</p>
              )}
            </div>

            {/* Valor Pago */}
            <div className="space-y-2">
              <Label htmlFor="valorPago">Valor Pago (R$) *</Label>
              <Input
                id="valorPago"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register("valorPago", { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
              {errors.valorPago && (
                <p className="text-sm text-destructive">{errors.valorPago.message}</p>
              )}
            </div>

            {/* Endereço */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="endereco">Endereço *</Label>
              <Input
                id="endereco"
                placeholder="Rua, número, bairro, cidade/UF"
                {...register("endereco")}
                className="bg-secondary border-border"
              />
              {errors.endereco && (
                <p className="text-sm text-destructive">{errors.endereco.message}</p>
              )}
            </div>

            {/* Recorrência */}
            <div className="space-y-2">
              <Label>Recorrência de Pagamento *</Label>
              <Select
                value={watch("recorrencia")}
                onValueChange={(value) =>
                  setValue("recorrencia", value as ClientSchemaType["recorrencia"])
                }
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {recorrenciaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.recorrencia && (
                <p className="text-sm text-destructive">{errors.recorrencia.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) =>
                  setValue("status", value as ClientSchemaType["status"])
                }
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-destructive">{errors.status.message}</p>
              )}
            </div>

            {/* Responsável */}
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                placeholder="Nome do responsável"
                {...register("responsavel")}
                className="bg-secondary border-border"
              />
              {errors.responsavel && (
                <p className="text-sm text-destructive">{errors.responsavel.message}</p>
              )}
            </div>

            {/* Contato Interno */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="contatoInterno">Contato Interno *</Label>
              <Input
                id="contatoInterno"
                placeholder="Telefone ou email"
                {...register("contatoInterno")}
                className="bg-secondary border-border"
              />
              {errors.contatoInterno && (
                <p className="text-sm text-destructive">{errors.contatoInterno.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
