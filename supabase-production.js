(function () {
  const cfg = window.BOAMEC_CONFIG || {};
  const enabled = Boolean(cfg.productionAuth && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);

  if (!enabled) {
    window.BOAMEC_BACKEND = { enabled: false };
    return;
  }

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit"
    }
  });

  const rolePermissions = {
    Administrador: ["inicio", "agenda", "os", "clientes", "financeiro", "mecanicos", "produtos", "relatorios", "configuracoes"],
    Gerente: ["inicio", "agenda", "os", "clientes", "financeiro", "mecanicos", "produtos", "relatorios"],
    Mecanico: ["inicio", "agenda", "os", "clientes"],
    Financeiro: ["inicio", "financeiro", "relatorios"],
    Atendente: ["inicio", "agenda", "os", "clientes"]
  };

  window.BOAMEC_BACKEND = {
    enabled: true,
    client,
    user: null,
    profile: null,
    company: null,
    subscription: null
  };

  function setLoginMessage(message) {
    if (typeof showLogin === "function") showLogin(message || "");
  }

  function subscriptionExpired(subscription) {
    if (!subscription) return true;
    if (["vencido", "cancelado"].includes(subscription.status)) return true;
    if (!subscription.data_fim) return false;
    return new Date(subscription.data_fim) < new Date();
  }

  function trialDaysLeft(subscription) {
    if (!subscription?.data_fim) return 0;
    return Math.max(0, Math.ceil((new Date(subscription.data_fim) - Date.now()) / 86400000));
  }

  function cleanAuthUrl() {
    if (window.location.hash.includes("access_token=") || window.location.search.includes("code=")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function isAuthCallback() {
    return window.location.hash.includes("access_token=") || window.location.search.includes("code=");
  }

  function readOAuthTokensFromUrl() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async function storeUrlSession() {
    const tokens = readOAuthTokensFromUrl();
    if (!tokens) return true;
    const { error } = await client.auth.setSession(tokens);
    cleanAuthUrl();
    if (error) {
      console.error("BOAMEC Google session error:", error);
      setLoginMessage(`Nao consegui concluir o login do Google: ${error.message || "tente novamente"}.`);
      return false;
    }
    return true;
  }

  function applyProfileToState(profile, company, subscription) {
    const permissions = profile.permissoes?.length ? profile.permissoes : rolePermissions[profile.cargo] || rolePermissions.Atendente;
    state.currentUserId = profile.id;
    state.users = [{
      id: profile.id,
      name: profile.nome,
      role: profile.cargo,
      email: profile.email,
      password: "",
      permissions
    }];
    state.brand.name = company?.nome_fantasia || "BOAMEC";
    state.company.legalName = company?.razao_social || state.company.legalName;
    state.company.tradeName = company?.nome_fantasia || state.company.tradeName;
    state.company.phone = company?.telefone || state.company.phone;
    state.company.address = company?.endereco || state.company.address;
    state.security.trialStartedAt = subscription?.data_inicio || new Date().toISOString();
    state.security.trialDays = Math.max(1, trialDaysLeft(subscription));