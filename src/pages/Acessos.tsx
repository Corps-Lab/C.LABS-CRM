import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { toast } from "sonner";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";

export default function Acessos() {
  const { signUp } = useAuth();
  const { currentAgency, isIsolated } = useAgency();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [nivel, setNivel] = useState<"ceo" | "admin" | "colaborador">("colaborador");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setCpf("");
    setNome("");
    setCargo("");
    setNivel("colaborador");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!email || !password || !cpf || !nome || !cargo) {
      toast.error("Preencha todos os campos.");
      setLoading(false);
      return;
    }
    const { error } = await signUp(email, password, nome, "", nivel, cpf, cargo);
    if (error) {
      toast.error(error.message || "Erro ao criar acesso.");
    } else {
      toast.success("Acesso criado com sucesso.");
      resetForm();
      setIsCreateOpen(false);
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_22px_hsl(var(--primary)/0.25)]">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestao de Acessos</h1>
            <p className="text-sm text-muted-foreground">
              Crie e organize acessos da agencia sem sair da pagina.
            </p>
          </div>
        </div>
        <Button className="gap-2 self-start sm:self-auto" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Criar Acesso
        </Button>
      </div>

      <Card className="border border-primary/30 bg-card/70">
        <CardHeader>
          <CardTitle className="text-lg">Acessos da agência</CardTitle>
          <p className="text-sm text-muted-foreground">
            Agência atual: <span className="text-foreground font-medium">{currentAgency.name}</span>
            {isIsolated ? " (dados isolados deste CRM)" : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Criação de acesso em mini janela</p>
                <p className="text-sm text-muted-foreground">
                  Use o botão <span className="font-medium text-foreground">Criar Acesso</span> para abrir o cadastro sem
                  sair desta tela.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open && !loading) resetForm();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar acesso de colaborador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 pt-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="colaborador@clabs.ag" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo / Squad" />
            </div>
            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <Select value={nivel} onValueChange={(v: "ceo" | "admin" | "colaborador") => setNivel(v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ceo">CEO</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={loading}
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="h-11 sm:min-w-[160px]" disabled={loading}>
                  {loading ? "Criando..." : "Criar acesso"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
