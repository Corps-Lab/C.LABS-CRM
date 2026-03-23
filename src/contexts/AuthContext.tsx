import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeId } from "@/lib/safeId";
import { useAgency } from "./AgencyContext";


const mockUsers = [
  { email: 'ceo@clabs.ag', password: 'teste123', nome: 'CEO C.LABS', role: 'ceo' as AppRole },
  { email: 'colab@clabs.ag', password: 'teste123', nome: 'Colaborador C.LABS', role: 'colaborador' as AppRole },
];

type AppRole = "admin" | "colaborador" | "ceo";
type AccessControlStatusRow = {
  is_active?: boolean | null;
};

type AccessControlsLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: AccessControlStatusRow | null; error: unknown }>;
      };
    };
  };
};

type LocalUserRecord = {
  id: string;
  email: string;
  password: string;
  nome: string;
  role: AppRole;
  active?: boolean;
  telefone?: string | null;
  cpf?: string | null;
  cargo?: string | null;
};

type LocalSessionRecord = { userId: string; email: string; nome: string; role: AppRole };

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  cpf?: string | null;
  cargo?: string | null;
  nivel_acesso?: AppRole | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, telefone: string, role: AppRole, cpf?: string, cargo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: Error | null }>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Só usa modo mock se for explicitamente habilitado. Em produção (Pages) usamos sempre Supabase,
// mesmo que as variáveis não estejam presentes em tempo de build (há fallback hardcoded no client).
const isMockAuthEnabled = () => import.meta.env.VITE_USE_MOCK_AUTH === "true";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeRole = (value: unknown): AppRole => {
  if (value === "ceo" || value === "admin" || value === "colaborador") return value;
  return "colaborador";
};

const normalizeAgencyEmail = (value: string, agencyId: string) => {
  const email = normalizeEmail(value);
  if (agencyId !== "corps") return email;

  if (email === "ceo@sky.ag" || email === "ceo@agenciaceu.ag") return "ceo@corps.ag";

  return email
    .replace(/@sky\.ag$/i, "@corps.ag")
    .replace(/@agenciaceu\.ag$/i, "@corps.ag")
    .replace(/@agenciacorps\.ag$/i, "@corps.ag");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { currentAgency, isIsolated } = useAgency();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const localUsersKey = useMemo(() => `crm_${currentAgency.id}_users`, [currentAgency.id]);
  const localSessionKey = useMemo(() => `crm_${currentAgency.id}_session`, [currentAgency.id]);
  const accessStatusOverridesKey = useMemo(
    () => `crm_${currentAgency.id}_access_status_overrides`,
    [currentAgency.id]
  );

  const normalizeLocalUsers = (users: LocalUserRecord[]) =>
    users.map((userRecord) => ({
      ...userRecord,
      email: normalizeAgencyEmail(userRecord.email, currentAgency.id),
      active: userRecord.active !== false,
    }));

  const readAccessStatusOverrides = (): Record<string, boolean> => {
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

  const isAccessControlsMissingError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const message = "message" in error ? String(error.message || "").toLowerCase() : "";
    return message.includes("access_controls") && (message.includes("relation") || message.includes("schema cache"));
  };

  const getRemoteAccessStatus = async (userId: string): Promise<boolean | null> => {
    try {
      const accessControlsClient = supabase as unknown as AccessControlsLookupClient;
      const { data, error } = await accessControlsClient
        .from("access_controls")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (isAccessControlsMissingError(error)) return null;
        console.warn("Erro ao buscar status de acesso remoto:", error);
        return null;
      }

      if (!data || typeof data.is_active !== "boolean") return null;
      return data.is_active;
    } catch {
      return null;
    }
  };

  const migrateLegacyCorpsIdentity = () => {
    if (currentAgency.id !== "corps") return;

    try {
      const rawUsers = localStorage.getItem(localUsersKey);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers) as LocalUserRecord[];
        const migratedUsers = normalizeLocalUsers(parsedUsers).map((userRecord) => ({
          ...userRecord,
          email: normalizeAgencyEmail(userRecord.email, "corps"),
        }));
        localStorage.setItem(localUsersKey, JSON.stringify(migratedUsers));
      }

      const rawSession = localStorage.getItem(localSessionKey);
      if (rawSession) {
        const parsedSession = JSON.parse(rawSession) as LocalSessionRecord;
        const migratedSession = {
          ...parsedSession,
          email: normalizeAgencyEmail(parsedSession.email, "corps"),
        };
        localStorage.setItem(localSessionKey, JSON.stringify(migratedSession));
      }
    } catch {
      /* ignore migration failure */
    }
  };

  const loadLocalUsers = (): LocalUserRecord[] => {
    try {
      const raw = localStorage.getItem(localUsersKey);
      const parsed = raw ? (JSON.parse(raw) as LocalUserRecord[]) : [];
      return normalizeLocalUsers(parsed);
    } catch {
      return [];
    }
  };

  const persistLocalUsers = (users: LocalUserRecord[]) => {
    try {
      localStorage.setItem(localUsersKey, JSON.stringify(users));
    } catch {
      /* ignore storage failure */
    }
  };

  const ensureDefaultCeo = () => {
    if (!isIsolated) return;
    const users = loadLocalUsers();
    if (users.some((u) => u.role === "ceo")) return;
    const seedUser = {
      id: safeId("user"),
      email: `ceo@${currentAgency.id}.ag`,
      password: "azul123",
      nome: `CEO ${currentAgency.name}`,
      role: "ceo" as AppRole,
      active: true,
      cpf: null,
      cargo: "CEO",
    };
    persistLocalUsers([...users, seedUser]);
  };

  const loadLocalSession = (): LocalSessionRecord | null => {
    try {
      const raw = localStorage.getItem(localSessionKey);
      return raw ? (JSON.parse(raw) as LocalSessionRecord) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (isIsolated) {
      migrateLegacyCorpsIdentity();
      ensureDefaultCeo();
      const stored = loadLocalSession();
      if (stored) {
        const localUser = { id: stored.userId, email: stored.email, user_metadata: { name: stored.nome } } as unknown as User;
        setUser(localUser);
        setSession(null);
        setProfile({
          id: stored.userId,
          user_id: stored.userId,
          nome: stored.nome,
          telefone: null,
          cpf: null,
          cargo: stored.role === "ceo" ? "CEO" : stored.role === "admin" ? "Admin" : "Colaborador",
          nivel_acesso: stored.role,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRole(stored.role);
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIsolated, currentAgency.id]);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) throw roleError;
      setRole(roleData?.role ?? null);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (isIsolated) {
        const normalizedInputEmail = normalizeAgencyEmail(email, currentAgency.id);
        const users = loadLocalUsers();
        const found = users.find(
          (u) => normalizeAgencyEmail(u.email, currentAgency.id) === normalizedInputEmail && u.password === password
        );
        if (found) {
          if (found.active === false) throw new Error("Acesso inativo. Fale com o administrador.");
          const localUser = { id: found.id || safeId("user"), email: found.email, user_metadata: { name: found.nome } } as unknown as User;
          setUser(localUser);
          setSession(null);
          setProfile({
            id: localUser.id,
            user_id: localUser.id,
            nome: found.nome,
            telefone: found.telefone || null,
            cpf: found.cpf || null,
            cargo: found.cargo || null,
            nivel_acesso: found.role,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setRole(found.role);
          try {
            localStorage.setItem(
              localSessionKey,
              JSON.stringify({ userId: localUser.id, email: found.email, nome: found.nome, role: found.role })
            );
          } catch {
            /* ignore */
          }
          setLoading(false);
          return { error: null };
        }

        // Fallback para mobile/novo dispositivo: tenta autenticar no Supabase e sincroniza localmente.
        const { data: remoteAuth, error: remoteAuthError } = await supabase.auth.signInWithPassword({
          email: normalizedInputEmail,
          password,
        });
        if (remoteAuthError || !remoteAuth.user) {
          throw new Error("Credenciais inválidas para esta agência");
        }

        const remoteUser = remoteAuth.user;
        const remoteStatus = await getRemoteAccessStatus(remoteUser.id);
        const localStatus = readAccessStatusOverrides()[remoteUser.id];
        const isActive = remoteStatus ?? localStatus ?? true;
        if (!isActive) {
          await supabase.auth.signOut();
          throw new Error("Acesso inativo. Peça ativação ao administrador.");
        }

        const [{ data: profileData }, { data: roleData }] = await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", remoteUser.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", remoteUser.id).maybeSingle(),
        ]);

        const remoteRole = normalizeRole(roleData?.role || profileData?.nivel_acesso);
        const remoteName =
          profileData?.nome ||
          (typeof remoteUser.user_metadata?.name === "string" ? remoteUser.user_metadata.name : "") ||
          normalizedInputEmail.split("@")[0];

        setUser(remoteUser);
        setSession(remoteAuth.session ?? null);
        setProfile({
          id: String(profileData?.id || remoteUser.id),
          user_id: remoteUser.id,
          nome: remoteName,
          telefone: profileData?.telefone || null,
          cpf: profileData?.cpf || null,
          cargo: profileData?.cargo || null,
          nivel_acesso: remoteRole,
          avatar_url: profileData?.avatar_url || null,
          created_at: String(profileData?.created_at || new Date().toISOString()),
          updated_at: String(profileData?.updated_at || new Date().toISOString()),
        });
        setRole(remoteRole);

        try {
          const existing = loadLocalUsers();
          const syncedUser: LocalUserRecord = {
            id: remoteUser.id,
            email: normalizedInputEmail,
            password,
            nome: remoteName,
            role: remoteRole,
            active: true,
            telefone: profileData?.telefone || null,
            cpf: profileData?.cpf || null,
            cargo: profileData?.cargo || null,
          };
          const next = existing.some((u) => u.id === remoteUser.id || normalizeAgencyEmail(u.email, currentAgency.id) === normalizedInputEmail)
            ? existing.map((u) =>
                u.id === remoteUser.id || normalizeAgencyEmail(u.email, currentAgency.id) === normalizedInputEmail
                  ? syncedUser
                  : u
              )
            : [...existing, syncedUser];
          persistLocalUsers(next);
          localStorage.setItem(
            localSessionKey,
            JSON.stringify({
              userId: remoteUser.id,
              email: normalizedInputEmail,
              nome: remoteName,
              role: remoteRole,
            })
          );
        } catch {
          /* ignore */
        }

        setLoading(false);
        return { error: null };
      }

      if (isMockAuthEnabled()) {
        const found = mockUsers.find((u) => u.email === email && u.password === password);
        if (!found) throw new Error("Credenciais inválidas");
        const mockUser = { id: safeId("user"), email: found.email, user_metadata: { name: found.nome } } as unknown as User;
        setUser(mockUser);
        setSession(null);
        setProfile({ id: mockUser.id, user_id: mockUser.id, nome: found.nome, telefone: null, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        setRole(found.role);
        setLoading(false);
        return { error: null };
      }

      const normalizedEmail = normalizeEmail(email);
      if (
        currentAgency.id !== "corps" &&
        /@(corps\.ag|agenciacorps\.ag|sky\.ag|agenciaceu\.ag)$/i.test(normalizedEmail)
      ) {
        throw new Error("Selecione a agência 'Agência Corps' para usar este acesso.");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      const signedInUserId = data.user?.id;
      if (signedInUserId) {
        const remoteStatus = await getRemoteAccessStatus(signedInUserId);
        const localStatus = readAccessStatusOverrides()[signedInUserId];
        const isActive = remoteStatus ?? localStatus ?? true;
        if (!isActive) {
          await supabase.auth.signOut();
          throw new Error("Acesso inativo. Peça ativação ao administrador.");
        }
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, nome: string, telefone: string, role: AppRole, cpf?: string, cargo?: string) => {
    try {
      if (isIsolated) {
        const normalizedInputEmail = normalizeAgencyEmail(email, currentAgency.id);
        const users = loadLocalUsers();
        if (users.some((u) => normalizeAgencyEmail(u.email, currentAgency.id) === normalizedInputEmail)) {
          throw new Error("E-mail já cadastrado para esta agência");
        }
        const localUser = {
          id: safeId("user"),
          email: normalizedInputEmail,
          password,
          nome,
          telefone: telefone || null,
          cpf: cpf || null,
          cargo: cargo || null,
          role,
          active: true,
        };
        persistLocalUsers([...users, localUser]);
        // Auto-login apenas se não houver usuário ativo (ex: criação pela tela de login)
        if (!user) {
          setUser({ id: localUser.id, email: localUser.email } as unknown as User);
          setProfile({
            id: localUser.id,
            user_id: localUser.id,
            nome: localUser.nome,
            telefone: localUser.telefone,
            cpf: localUser.cpf,
            cargo: localUser.cargo,
            nivel_acesso: localUser.role,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setRole(localUser.role);
          try {
            localStorage.setItem(
              localSessionKey,
              JSON.stringify({ userId: localUser.id, email: localUser.email, nome: localUser.nome, role: localUser.role })
            );
          } catch {
            /* ignore */
          }
        }
        return { error: null };
      }

      if (isMockAuthEnabled()) {
        mockUsers.push({ email, password, nome, role });
        setRole(role);
        setProfile({ id: safeId("user"), user_id: "mock", nome, telefone: telefone || null, cpf: cpf || null, cargo: cargo || null, nivel_acesso: role, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return { error: null };
      }
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: authData.user.id,
        nome,
        telefone: telefone || null,
        cpf: cpf || null,
        cargo: cargo || null,
        nivel_acesso: role,
      });

      if (profileError) throw profileError;

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role,
      });

      if (roleError) throw roleError;

      // Log access (only if caller is manager; ignore errors silently)
      if (user?.id) {
        await supabase.from("acessos").insert({
          user_id: authData.user.id,
          created_by: user.id,
          cpf: cpf || null,
          cargo: cargo || null,
          role,
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (isIsolated) {
      try {
        localStorage.removeItem(localSessionKey);
      } catch {
        /* ignore */
      }
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    try {
      if (isIsolated) {
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
        return { error: null };
      }

      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setProfile((prev) => (prev ? { ...prev, ...data } : null));
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const uploadAvatar = async (file: File) => {
    try {
      // Mock mode: apenas salva localmente em memória
      if (isIsolated || isMockAuthEnabled()) {
        const url = URL.createObjectURL(file);
        setProfile((prev) =>
          prev
            ? { ...prev, avatar_url: url }
            : {
                id: safeId("user"),
                user_id: "mock",
                nome: prev?.nome || "Usuário Mock",
                telefone: prev?.telefone || null,
                cpf: prev?.cpf || null,
                cargo: prev?.cargo || null,
                nivel_acesso: prev?.nivel_acesso || role || "colaborador",
                avatar_url: url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
        );
        return { url, error: null };
      }

      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: avatarUrl });

      return { url: avatarUrl, error: null };
    } catch (error) {
      return { url: null, error: error as Error };
    }
  };

  const value = {
    user,
    session,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    uploadAvatar,
    isAdmin: role === "admin" || role === "ceo",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
