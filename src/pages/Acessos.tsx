import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";

type AccessLevel = "ceo" | "admin" | "colaborador";

type AccessMember = {
  userId: string;
  nome: string;
  email?: string;
  cpf?: string | null;
  cargo?: string | null;
  role: AccessLevel;
  active: boolean;
  createdAt?: string;
};

type LocalUserRecord = {
  id: string;
  email: string;
  nome: string;
  role: AccessLevel;
  active?: boolean;
  cpf?: string | null;
  cargo?: string | null;
};

type ProfileRow = {
  user_id: string;
  nome?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  created_at?: string | null;
  nivel_acesso?: string | null;
};

type RoleRow = {
  user_id: string;
  role?: string | null;
};

type AccessControlRow = {
  user_id: string;
  is_active: boolean;
};

type AccessControlsTableClient = {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: AccessControlRow[] | null; error: unknown }>;
    upsert: (
      values: { user_id: string; is_active: boolean; updated_by: string | null },
      options: { onConflict: string }
    ) => Promise<{ error: unknown }>;
  };
};

const rolePriority: Record<AccessLevel, number> = {
  ceo: 0,
  admin: 1,
  colaborador: 2,
};

const roleLabel: Record<AccessLevel, string> = {
  ceo: "CEO",
  admin: "Admin",
  colaborador: "Colaborador",
};

const roleBadgeClass: Record<AccessLevel, string> = {
  ceo: "bg-primary/20 text-primary border-primary/40",
  admin: "bg-blue-500/15 text-blue-400 border-blue-400/30",
  colaborador: "bg-muted/50 text-foreground border-border",
};

const normalizeLevel = (value: unknown): AccessLevel => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "colaborador";
  if (normalized === "ceo") return "ceo";
  if (normalized === "admin") return "admin";
  return "colaborador";
};

const isAccessControlsMissingError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message || "").toLowerCase() : "";
  return message.includes("access_controls") && (message.includes("relation") || message.includes("schema cache"));
};

export default function Acessos() {
  const { signUp, isAdmin, user } = useAuth();
  const { currentAgency, isIsolated } = useAgency();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [nivel, setNivel] = useState<"ceo" | "admin" | "colaborador">("colaborador");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const localUsersKey = useMemo(() => `crm_${currentAgency.id}_users`, [currentAgency.id]);
  const accessStatusOverridesKey = useMemo(
    () => `crm_${currentAgency.id}_access_status_overrides`,
    [currentAgency.id]
  );

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setCpf("");
    setNome("");
    setCargo("");
    setNivel("colaborador");
  };

  const readStatusOverrides = (): Record<string, boolean> => {
    try {
      const raw = localStorage.getItem(accessStatusOverridesKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
        )
      );
    } catch {
      return {};
    }
  };

  const writeStatusOverride = (userId: string, active: boolean) => {
    try {
      const previous = readStatusOverrides();
      localStorage.setItem(
        accessStatusOverridesKey,
        JSON.stringify({
          ...previous,
          [userId]: active,
        })
      );
    } catch {
      /* ignore storage failures */
    }
  };

  const sortMembers = (items: AccessMember[]) =>
    [...items].sort((a, b) => {
      const roleDelta = rolePriority[a.role] - rolePriority[b.role];
      if (roleDelta !== 0) return roleDelta;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  const loadMembers = async () => {
    setLoadingMembers(true);

    try {
      if (isIsolated) {
        const rawUsers = localStorage.getItem(localUsersKey);
        const parsedUsers = rawUsers ? (JSON.parse(rawUsers) as LocalUserRecord[]) : [];
        const statusOverrides = readStatusOverrides();
        const mapped = parsedUsers.map((localUser) => ({
          userId: localUser.id,
          nome: localUser.nome || "Sem nome",
          email: localUser.email || "",
          cpf: localUser.cpf || null,
          cargo: localUser.cargo || null,
          role: normalizeLevel(localUser.role),
          active: localUser.active ?? statusOverrides[localUser.id] ?? true,
        }));
        setMembers(sortMembers(mapped));
        return;
      }

      const [profilesRes, rolesRes, controlsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
        (supabase as unknown as AccessControlsTableClient)
          .from("access_controls")
          .select("user_id, is_active"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const statusOverrides = readStatusOverrides();
      const controlsByUser = new Map<string, boolean>();

      if (!controlsRes.error && Array.isArray(controlsRes.data)) {
        for (const row of controlsRes.data) {
          if (row && typeof row.user_id === "string" && typeof row.is_active === "boolean") {
            controlsByUser.set(row.user_id, row.is_active);
          }
        }
      } else if (controlsRes.error && !isAccessControlsMissingError(controlsRes.error)) {
        console.warn("Falha ao carregar access_controls:", controlsRes.error);
      }

      const rolesByUser = new Map<string, AccessLevel>();
      for (const row of (rolesRes.data || []) as RoleRow[]) {
        if (!row?.user_id) continue;
        rolesByUser.set(row.user_id, normalizeLevel(row.role));
      }

      const profilesByUser = new Map<string, ProfileRow>();
      for (const profile of (profilesRes.data || []) as unknown as ProfileRow[]) {
        if (!profile?.user_id) continue;
        profilesByUser.set(profile.user_id, profile);
        if (!rolesByUser.has(profile.user_id)) {
          rolesByUser.set(profile.user_id, normalizeLevel(profile.nivel_acesso));
        }
      }

      const userIds = new Set<string>([
        ...Array.from(rolesByUser.keys()),
        ...Array.from(profilesByUser.keys()),
      ]);

      const mapped: AccessMember[] = Array.from(userIds).map((userId) => {
        const profile = profilesByUser.get(userId);
        const role = rolesByUser.get(userId) || normalizeLevel(profile?.nivel_acesso);
        const remoteActive = controlsByUser.get(userId);
        const localActive = statusOverrides[userId];

        return {
          userId,
          nome: profile?.nome || "Usuário sem nome",
          cpf: profile?.cpf || null,
          cargo: profile?.cargo || null,
          role,
          active: remoteActive ?? localActive ?? true,
          createdAt: profile?.created_at || undefined,
        };
      });

      setMembers(sortMembers(mapped));
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar os acessos.");
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAgency.id, isIsolated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isAdmin) {
      toast.error("Somente gestores podem criar novos acessos.");
      setLoading(false);
      return;
    }

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
      await loadMembers();
    }
    setLoading(false);
  };

  const handleToggleAccess = async (member: AccessMember, nextActive: boolean) => {
    if (!isAdmin) {
      toast.error("Somente gestores podem alterar status de acesso.");
      return;
    }

    if (!nextActive && member.userId === user?.id) {
      toast.error("Você não pode inativar seu próprio acesso.");
      return;
    }

    setUpdatingUserId(member.userId);

    try {
      if (isIsolated) {
        const rawUsers = localStorage.getItem(localUsersKey);
        const parsedUsers = rawUsers ? (JSON.parse(rawUsers) as LocalUserRecord[]) : [];
        const updatedUsers = parsedUsers.map((localUser) =>
          localUser.id === member.userId
            ? {
                ...localUser,
                active: nextActive,
              }
            : localUser
        );
        localStorage.setItem(localUsersKey, JSON.stringify(updatedUsers));
        writeStatusOverride(member.userId, nextActive);
      } else {
        const { error } = await (supabase as unknown as AccessControlsTableClient)
          .from("access_controls")
          .upsert(
            {
              user_id: member.userId,
              is_active: nextActive,
              updated_by: user?.id || null,
            },
            { onConflict: "user_id" }
          );

        if (error) {
          if (!isAccessControlsMissingError(error)) throw error;
          writeStatusOverride(member.userId, nextActive);
        }
      }

      setMembers((previous) =>
        previous.map((item) =>
          item.userId === member.userId
            ? {
                ...item,
                active: nextActive,
              }
            : item
        )
      );

      toast.success(`Acesso ${nextActive ? "ativado" : "inativado"} com sucesso.`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível atualizar o status do acesso.");
    } finally {
      setUpdatingUserId(null);
    }
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

      <Card className="border border-primary/30 bg-card/70">
        <CardHeader>
          <CardTitle className="text-lg">Equipe e status de acesso</CardTitle>
          <p className="text-sm text-muted-foreground">
            Veja todos os perfis cadastrados e ative ou inative o acesso de cada um.
          </p>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Você está em modo visualização. Somente CEO/Admin podem alterar status de acesso.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingMembers ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Carregando usuários...
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Nenhum acesso cadastrado ainda.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.userId}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">{member.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.email || "E-mail protegido"}{member.cargo ? ` • ${member.cargo}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={roleBadgeClass[member.role]}>
                      {roleLabel[member.role]}
                    </Badge>
                    <Badge variant="outline" className={member.active ? "bg-primary/15 text-primary border-primary/40" : "bg-destructive/10 text-destructive border-destructive/40"}>
                      {member.active ? "Ativo" : "Inativo"}
                    </Badge>
                    {member.cpf && (
                      <Badge variant="outline" className="bg-muted/50 border-border text-muted-foreground">
                        CPF: {member.cpf}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {updatingUserId === member.userId && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground">Ativar acesso</span>
                  <Switch
                    checked={member.active}
                    onCheckedChange={(checked) => void handleToggleAccess(member, checked)}
                    disabled={!isAdmin || updatingUserId === member.userId}
                    aria-label={`Ativar ou inativar acesso de ${member.nome}`}
                  />
                </div>
              </div>
            ))
          )}
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
