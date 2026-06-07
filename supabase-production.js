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
      detectSessionInUrl: true
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
    saveState();
  }

  async function loadTenantData(empresaId) {
    const [clientsRes, vehiclesRes, mechanicsRes, productsRes, agendaRes, ordersRes] = await Promise.allSettled([
      client.from("clientes").select("id,nome,telefones,endereco").eq("empresa_id", empresaId).order("nome"),
      client.from("veiculos").select("id,cliente_id,modelo,placa,cor").eq("empresa_id", empresaId).order("placa"),
      client.from("mecanicos").select("id,nome,telefone,percentual_comissao,status").eq("empresa_id", empresaId).order("nome"),
      client.from("produtos").select("id,codigo,nome,descricao,estoque_atual,estoque_minimo,unidade,preco_venda").eq("empresa_id", empresaId).order("nome"),
      client.from("agenda").select("id,cliente_nome,telefone,veiculo,placa,cor,data_agendada,hora_agendada,servico_previsto,mecanico_nome,status").eq("empresa_id", empresaId).order("data_agendada"),
      client.from("ordens_servico").select("id,numero,cliente_nome,telefone,veiculo,placa,cor,mecanico_nome,status,valor_total,km,relato_cliente,data_abertura,pago").eq("empresa_id", empresaId).order("numero", { ascending: false })
    ]);

    if (clientsRes.status === "fulfilled" && !clientsRes.value.error) {
      const vehicles = vehiclesRes.status === "fulfilled" && !vehiclesRes.value.error ? vehiclesRes.value.data : [];
      state.clients = clientsRes.value.data.map((c) => ({
        id: c.id,
        name: c.nome,
        phones: c.telefones || [],
        address: c.endereco || "",
        vehicles: vehicles.filter((v) => v.cliente_id === c.id).map((v) => ({
          id: v.id,
          name: v.modelo,
          plate: v.placa,
          color: v.cor
        }))
      }));
    }

    if (mechanicsRes.status === "fulfilled" && !mechanicsRes.value.error) {
      state.mechanics = mechanicsRes.value.data.map((m) => ({
        id: m.id,
        name: m.nome,
        phone: m.telefone || "",
        commissionPercent: Number(m.percentual_comissao || 0)
      }));
    }

    if (productsRes.status === "fulfilled" && !productsRes.value.error) {
      state.products = productsRes.value.data.map((p) => ({
        id: p.id,
        code: p.codigo,
        name: p.nome,
        description: p.descricao || "",
        stockQty: Number(p.estoque_atual || 0),
        minStock: Number(p.estoque_minimo || 0),
        unit: p.unidade || "un",
        price: Number(p.preco_venda || 0)
      }));
    }

    if (agendaRes.status === "fulfilled" && !agendaRes.value.error) {
      state.appointments = agendaRes.value.data.map((a) => ({
        id: a.id,
        client: a.cliente_nome,
        phone: a.telefone || "",
        plate: a.placa || "",
        vehicle: a.veiculo || "",
        color: a.cor || "",
        date: a.data_agendada,
        time: a.hora_agendada?.slice(0, 5) || "08:00",
        service: a.servico_previsto || "",
        mechanic: a.mecanico_nome || ""
      }));
    }

    if (ordersRes.status === "fulfilled" && !ordersRes.value.error) {
      state.orders = ordersRes.value.data.map((o) => ({
        id: String(o.numero).padStart(4, "0"),
        uuid: o.id,
        client: o.cliente_nome,
        phone: o.telefone || "",
        plate: o.placa || "",
        vehicle: o.veiculo || "",
        color: o.cor || "",
        mechanic: o.mecanico_nome || "",
        status: o.status,
        statusKey: o.status === "Finalizada" ? "done" : o.status === "Paga" ? "paid" : o.status === "Em andamento" ? "progress" : "open",
        value: Number(o.valor_total || 0),
        openedAt: o.data_abertura,
        paid: Boolean(o.pago),
        km: o.km || "",
        complaint: o.relato_cliente || "",
        services: [],
        parts: []
      }));
    }

    saveState();
  }

  async function hydrateSession() {
    const { data: sessionData } = await client.auth.getSession();
    const authUser = sessionData.session?.user;
    if (!authUser) {
      window.BOAMEC_BACKEND.user = null;
      setLoginMessage("");
      return false;
    }

    let { data: profile, error: profileError } = await client
      .from("usuarios")
      .select("id,empresa_id,nome,email,cargo,status,permissoes")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Usuario";
      const companyName = authUser.user_metadata?.company_name || `Oficina de ${name}`;
      const { error: trialError } = await client.rpc("criar_empresa_trial", {
        p_nome_fantasia: companyName,
        p_razao_social: companyName,
        p_email: authUser.email,
        p_usuario_nome: name
      });

      if (!trialError) {
        const profileResult = await client
          .from("usuarios")
          .select("id,empresa_id,nome,email,cargo,status,permissoes")
          .eq("id", authUser.id)
          .single();
        profile = profileResult.data;
        profileError = profileResult.error;
      }
    }

    if (profileError || !profile || profile.status !== "ativo") {
      await client.auth.signOut();
      setLoginMessage("Usuario sem acesso ativo. Fale com o administrador.");
      return false;
    }

    const [{ data: company }, { data: subscription }] = await Promise.all([
      client.from("empresas").select("*").eq("id", profile.empresa_id).single(),
      client.from("assinaturas").select("*").eq("empresa_id", profile.empresa_id).order("data_criacao", { ascending: false }).limit(1).single()
    ]);

    if (subscriptionExpired(subscription)) {
      await client.auth.signOut();
      setLoginMessage("Seu teste gratis terminou. Renove a assinatura para continuar.");
      return false;
    }

    window.BOAMEC_BACKEND.user = authUser;
    window.BOAMEC_BACKEND.profile = profile;
    window.BOAMEC_BACKEND.company = company;
    window.BOAMEC_BACKEND.subscription = subscription;
    applyProfileToState(profile, company, subscription);
    await loadTenantData(profile.empresa_id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: profile.id, loggedAt: new Date().toISOString(), mode: "supabase" }));
    showApp();
    renderAll();
    return true;
  }

  loginUser = async function () {
    const email = $("login-email")?.value.trim().toLowerCase();
    const password = $("login-password")?.value || "";
    if (!email || !password) return setLoginMessage("Informe e-mail e senha.");
    setLoginMessage("Validando acesso...");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return setLoginMessage("E-mail ou senha incorretos.");
    const ok = await hydrateSession();
    if (ok) {
      setScreen("home");
      toast("Acesso liberado com seguranca.");
    }
  };

  loginWithGoogle = async function () {
    setLoginMessage("Abrindo login do Google...");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "consent" }
      }
    });
    if (error) setLoginMessage("Nao foi possivel abrir o login do Google. Verifique o provedor no Supabase.");
  };

  logoutUser = async function () {
    closeModal();
    await client.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    window.BOAMEC_BACKEND.user = null;
    window.BOAMEC_BACKEND.profile = null;
    setLoginMessage("Sessao encerrada com seguranca.");
  };

  isAuth = function () {
    return Boolean(window.BOAMEC_BACKEND.profile);
  };

  access = function (permission, label = "modulo") {
    if (!isAuth()) {
      setLoginMessage("Entre para acessar o sistema.");
      return false;
    }
    const profile = window.BOAMEC_BACKEND.profile;
    const permissions = profile.permissoes?.length ? profile.permissoes : rolePermissions[profile.cargo] || [];
    if (!permissions.includes(permission)) {
      toast(`Sem permissao para ${label}`);
      return false;
    }
    if (subscriptionExpired(window.BOAMEC_BACKEND.subscription)) {
      setLoginMessage("Seu teste gratis terminou. Renove a assinatura para continuar.");
      return false;
    }
    return true;
  };

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) hydrateSession();
  });

  hydrateSession();
})();
