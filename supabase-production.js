/**
 * BOAMEC — Supabase Production Backend
 *
 * Este arquivo é carregado DEPOIS de app.js e substitui as funções de auth
 * e persistência de dados quando o Supabase está configurado.
 */
(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     0. Guarda de inicialização
  ───────────────────────────────────────────── */
  const cfg = window.BOAMEC_CONFIG || {};
  const hasSupabaseLib = Boolean(window.supabase && typeof window.supabase.createClient === "function");
  const enabled = Boolean(
    cfg.productionAuth && cfg.supabaseUrl && cfg.supabaseAnonKey && hasSupabaseLib
  );

  if (!enabled) {
    window.BOAMEC_BACKEND = { enabled: false };
    console.info("[BOAMEC] Modo local ativo (productionAuth desativado ou bibliotecas ausentes).");
    return;
  }

  /* ─────────────────────────────────────────────
     1. Cliente Supabase
  ───────────────────────────────────────────── */
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });

  /* ─────────────────────────────────────────────
     2. Mapeamento de cargos → permissões padrão
  ───────────────────────────────────────────── */
  const ROLE_PERMISSIONS = {
    Administrador: ["inicio", "agenda", "os", "clientes", "financeiro", "mecanicos", "produtos", "relatorios", "configuracoes"],
    Gerente:       ["inicio", "agenda", "os", "clientes", "financeiro", "mecanicos", "produtos", "relatorios"],
    Mecanico:      ["inicio", "agenda", "os", "clientes"],
    Financeiro:    ["inicio", "financeiro", "relatorios"],
    Atendente:     ["inicio", "agenda", "os", "clientes"],
  };

  /* ─────────────────────────────────────────────
     3. Estado interno do backend
  ───────────────────────────────────────────── */
  window.BOAMEC_BACKEND = {
    enabled: true,
    client,
    user: null,
    profile: null,
    company: null,
    subscription: null,

    // Auth público
    loginWithEmailPassword,
    logoutUser: signOut,
    loadSession,
    registerCompany,
    showOnboarding,
    isSubscriptionValid,

    // Sync de Dados (Fase 2)
    loadAllData,
    syncSaveClient,
    syncSaveMechanic,
    syncSaveProduct,
    syncSaveAppointment,
    syncSaveOrder,
    syncReceiveOrder,
    syncPayPayable,
    syncPayCommissions,
    syncSaveCompany
  };

  /* ─────────────────────────────────────────────
     4. Helpers de UI
  ───────────────────────────────────────────── */
  function setLoginMessage(msg) {
    const el = document.getElementById("login-error");
    if (el) el.textContent = msg || "";
  }

  function setLoginLoading(loading) {
    const btn = document.querySelector("[data-action='login']");
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? "Entrando..." : "Entrar";
  }

  function callShowLogin(msg) {
    if (typeof showLogin === "function") showLogin(msg || "");
  }

  function callShowApp() {
    if (typeof showApp === "function") showApp();
  }

  function callSetScreen(screen) {
    if (typeof setScreen === "function") setScreen(screen);
  }

  function callToast(msg) {
    if (typeof toast === "function") toast(msg);
  }

  function callRenderAll() {
    if (typeof renderAll === "function") renderAll();
  }

  /* ─────────────────────────────────────────────
     5. Verificação de assinatura
  ───────────────────────────────────────────── */
  function isSubscriptionValid(subscription) {
    if (!subscription || !["ativo", "trial"].includes(subscription.status) || !subscription.data_fim) return false;
    return new Date(subscription.data_fim) > new Date();
  }

  function trialDaysLeft(subscription) {
    if (!subscription?.data_fim) return 0;
    return Math.max(0, Math.ceil((new Date(subscription.data_fim) - Date.now()) / 86400000));
  }

  /* ─────────────────────────────────────────────
     6. OAuth & Sessions
  ───────────────────────────────────────────── */
  function cleanAuthUrl() {
    const hasTokenInHash = window.location.hash.includes("access_token=");
    const hasCodeInSearch = window.location.search.includes("code=");
    if (hasTokenInHash || hasCodeInSearch) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function isOAuthCallback() {
    return (
      window.location.hash.includes("access_token=") ||
      window.location.search.includes("code=")
    );
  }

  function readOAuthTokensFromUrl() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async function storeUrlSession() {
    if (!isOAuthCallback()) return true;

    try {
      const hash = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.warn("[BOAMEC] Aviso no setSession:", error.message);
        }
      }
      cleanAuthUrl();
    } catch (err) {
      console.error("[BOAMEC] Erro no storeUrlSession:", err);
    }
    return true;
  }

  /* ─────────────────────────────────────────────
     7. Perfil e Empresa
  ───────────────────────────────────────────── */
  async function fetchProfileAndCompany(userId) {
    const { data: profile, error: profileError } = await client
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.warn("[BOAMEC] Perfil não encontrado para uid:", userId, profileError);
      return { profile: null, company: null, subscription: null };
    }

    const { data: company } = await client
      .from("empresas")
      .select("*")
      .eq("id", profile.empresa_id)
      .single();

    const { data: subscriptions } = await client
      .from("assinaturas")
      .select("*")
      .eq("empresa_id", profile.empresa_id)
      .order("data_fim", { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    return { profile, company, subscription };
  }

  function applyProfileToAppState(profile, company, subscription) {
    if (!profile) return;

    const permissions = profile.permissoes?.length
      ? profile.permissoes
      : ROLE_PERMISSIONS[profile.cargo] || ROLE_PERMISSIONS["Atendente"];

    window.BOAMEC_BACKEND.profile = profile;
    window.BOAMEC_BACKEND.company = company;
    window.BOAMEC_BACKEND.subscription = subscription;

    state.currentUserId = profile.id;
    state.users = [
      {
        id: profile.id,
        name: profile.nome,
        role: profile.cargo,
        email: profile.email,
        password: "",
        permissions,
      },
    ];

    if (company) {
      state.brand.name = company.nome_fantasia || "BOAMEC";
      state.brand.primary = company.cor_primaria || "#5368e8";
      state.company.legalName = company.razao_social || "";
      state.company.tradeName = company.nome_fantasia || "BOAMEC";
      state.company.phone = company.telefone || "";
      state.company.address = company.endereco || "";
      state.company.city = company.cidade || "";
      state.company.state = company.estado || "";
      state.company.zip = company.cep || "";
    }

    if (subscription) {
      state.security.trialStartedAt = subscription.data_inicio || new Date().toISOString();
      state.security.trialDays = Math.max(1, trialDaysLeft(subscription));
    }

    if (typeof saveState === "function") saveState();

    // Carrega dados da empresa do Supabase
    loadAllData();
  }

  function checkSubscriptionBlock(subscription) {
    if (!isSubscriptionValid(subscription)) {
      window.location.assign("/planos");
      return false;
    }
    return true;
  }

  /* ─────────────────────────────────────────────
     8. Auth Handlers
  ───────────────────────────────────────────── */
  async function loginWithEmailPassword(email, password) {
    setLoginLoading(true);
    setLoginMessage("");

    try {
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !authData?.user) {
        console.error("[BOAMEC] Detalhes do erro de login do Supabase:", authError);
        setLoginLoading(false);
        const msg = authError?.message || "Erro desconhecido";
        if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
          setLoginMessage(`E-mail ou senha incorretos. Verifique seus dados. (${msg})`);
        } else {
          setLoginMessage(`Erro ao entrar: ${msg}`);
        }
        return false;
      }

      window.BOAMEC_BACKEND.user = authData.user;

      const { profile, company, subscription } = await fetchProfileAndCompany(authData.user.id);

      if (!profile) {
        setLoginLoading(false);
        showOnboarding();
        return false;
      }

      if (!checkSubscriptionBlock(subscription)) {
        setLoginLoading(false);
        return false;
      }

      applyProfileToAppState(profile, company, subscription);
      setLoginLoading(false);

      callShowApp();
      callSetScreen("home");
      callToast(`Bem-vindo, ${profile.nome}!`);
      return true;

    } catch (err) {
      console.error("[BOAMEC] Erro inesperado no login:", err);
      setLoginLoading(false);
      setLoginMessage("Erro inesperado. Tente novamente.");
      return false;
    }
  }

  async function signOut() {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn("[BOAMEC] Erro no signOut:", err);
    }

    window.BOAMEC_BACKEND.user = null;
    window.BOAMEC_BACKEND.profile = null;
    window.BOAMEC_BACKEND.company = null;
    window.BOAMEC_BACKEND.subscription = null;

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("oficina-premium-session");
    }

    callShowLogin("Sessão encerrada com segurança.");
  }

  async function loadSession() {
    // 1. Permite que o cliente Supabase leia a sessão da URL (#access_token=...) e do localStorage
    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      console.error("[BOAMEC] Erro ao obter sessão Supabase:", sessionError);
      cleanAuthUrl();
      callShowLogin(`Erro no Supabase: ${sessionError.message || "Chave anon inválida"}.`);
      return false;
    }

    const user = sessionData?.session?.user;

    if (!user) {
      cleanAuthUrl();
      callShowLogin();
      return false;
    }

    // Limpa os tokens da URL (#access_token=...) somente após a sessão ser validada
    cleanAuthUrl();

    window.BOAMEC_BACKEND.user = user;

    // 2. Busca perfil do usuário no banco de dados
    const { profile, company, subscription } = await fetchProfileAndCompany(user.id);

    if (!profile) {
      // Usuário autenticado pelo Google, mas sem oficina cadastrada -> Exibe Onboarding!
      showOnboarding();
      return false;
    }

    if (!checkSubscriptionBlock(subscription)) return false;

    applyProfileToAppState(profile, company, subscription);

    callShowApp();
    callSetScreen("home");
    return true;
  }

  async function registerCompany({ nomFantasia, razaoSocial, telefone, cnpj, nomeUsuario }) {
    const btn = document.getElementById("onboarding-submit");
    if (btn) { btn.disabled = true; btn.textContent = "Criando sua conta..."; }

    const errEl = document.getElementById("onboarding-error");
    if (errEl) errEl.textContent = "";

    const user = window.BOAMEC_BACKEND.user;
    if (!user) {
      if (errEl) errEl.textContent = "Sessão não encontrada. Tente entrar novamente.";
      if (btn) { btn.disabled = false; btn.textContent = "Criar minha oficina"; }
      return false;
    }

    try {
      let companyId = null;

      // 1. Tenta via RPC primeiro
      try {
        const { data, error } = await client.rpc("criar_empresa_trial", {
          p_nome_fantasia: nomFantasia,
          p_razao_social: razaoSocial || null,
          p_cnpj: cnpj || null,
          p_telefone: telefone || null,
          p_usuario_nome: nomeUsuario || null,
        });
        if (!error && data) companyId = data;
        else if (error) console.warn("[BOAMEC] RPC criar_empresa_trial indisponível, usando fallback direto:", error.message);
      } catch (rpcErr) {
        console.warn("[BOAMEC] Erro na RPC, aplicando fallback:", rpcErr);
      }

      // 2. Fallback direto se a RPC não retornou ID
      if (!companyId) {
        const { data: newComp, error: compErr } = await client
          .from("empresas")
          .insert({
            nome_fantasia: nomFantasia,
            razao_social: razaoSocial || null,
            cnpj: cnpj || null,
            telefone: telefone || null,
            email: user.email || null,
            plano: "trial",
            status: "trial",
            data_vencimento: new Date(Date.now() + 30 * 86400000).toISOString(),
            criado_por: user.id
          })
          .select("id")
          .single();

        if (compErr || !newComp) {
          throw new Error(compErr?.message || "Não foi possível cadastrar a empresa no banco.");
        }
        companyId = newComp.id;

        const userName = nomeUsuario || user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split("@")[0] : "Administrador");

        const { error: userErr } = await client
          .from("usuarios")
          .insert({
            id: user.id,
            empresa_id: companyId,
            nome: userName,
            email: user.email || "",
            cargo: "Administrador",
            permissoes: ["inicio", "agenda", "os", "clientes", "financeiro", "mecanicos", "produtos", "relatorios", "configuracoes"],
            status: "ativo",
            criado_por: user.id
          });

        if (userErr && !userErr.message.includes("duplicate")) {
          throw new Error(userErr.message || "Erro ao criar perfil de usuário.");
        }

        await client
          .from("assinaturas")
          .insert({
            empresa_id: companyId,
            plano: "trial",
            status: "trial",
            data_inicio: new Date().toISOString(),
            data_fim: new Date(Date.now() + 30 * 86400000).toISOString()
          });
      }

      const { profile, company, subscription } = await fetchProfileAndCompany(user.id);

      if (!profile) {
        if (errEl) errEl.textContent = "Empresa registrada, recarregue a página para acessar o painel.";
        if (btn) { btn.disabled = false; btn.textContent = "Criar minha oficina"; }
        return false;
      }

      applyProfileToAppState(profile, company, subscription);
      hideOnboarding();
      callShowApp();
      callSetScreen("home");
      callToast(`Bem-vindo à BOAMEC, ${profile.nome}! Sua oficina foi criada com sucesso.`);
      return true;

    } catch (err) {
      console.error("[BOAMEC] Erro inesperado ao registrar empresa:", err);
      if (errEl) errEl.textContent = `Erro: ${err.message || "Tente novamente."}`;
      if (btn) { btn.disabled = false; btn.textContent = "Criar minha oficina"; }
      return false;
    }
  }

  function showOnboarding() {
    document.body.classList.remove("login-active");
    document.body.classList.add("onboarding-active");

    const screen = document.getElementById("onboarding-screen");
    if (screen) screen.style.display = "flex";

    // Preenche nome do usuário vindo do Google OAuth (metadata)
    const user = window.BOAMEC_BACKEND.user;
    if (user) {
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const userInput = document.getElementById("onboarding-user-name");
      if (userInput && googleName && !userInput.value) {
        userInput.value = googleName;
      }
    }
  }

  function hideOnboarding() {
    document.body.classList.remove("onboarding-active");
    const screen = document.getElementById("onboarding-screen");
    if (screen) screen.style.display = "none";
  }

  function bindOnboardingEvents() {
    const form = document.getElementById("onboarding-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nomFantasia = document.getElementById("onboarding-name")?.value?.trim();
      const razaoSocial = document.getElementById("onboarding-legal-name")?.value?.trim();
      const telefone = document.getElementById("onboarding-phone")?.value?.trim();
      const cnpj = document.getElementById("onboarding-cnpj")?.value?.trim();
      const nomeUsuario = document.getElementById("onboarding-user-name")?.value?.trim();

      if (!nomFantasia) {
        const errEl = document.getElementById("onboarding-error");
        if (errEl) errEl.textContent = "Informe o nome da oficina para continuar.";
        return;
      }

      await registerCompany({ nomFantasia, razaoSocial, telefone, cnpj, nomeUsuario });
    });
  }

  /* ─────────────────────────────────────────────
     9. SINCRONIZAÇÃO DE DADOS (Fase 2)
  ───────────────────────────────────────────── */

  function getEmpresaId() {
    return window.BOAMEC_BACKEND.company?.id || window.BOAMEC_BACKEND.profile?.empresa_id;
  }

  async function loadAllData() {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      // 1. Clientes & Veículos
      const { data: clientsData } = await client.from("clientes").select("*, veiculos(*)");
      if (clientsData && clientsData.length > 0) {
        state.clients = clientsData.map(c => ({
          id: c.id,
          name: c.nome,
          phones: c.telefones || [],
          address: c.endereco || "",
          vehicles: (c.veiculos || []).map(v => ({
            id: v.id,
            name: v.modelo,
            plate: v.placa,
            color: v.cor || ""
          }))
        }));
      }

      // 2. Mecânicos
      const { data: mecsData } = await client.from("mecanicos").select("*");
      if (mecsData && mecsData.length > 0) {
        state.mechanics = mecsData.map(m => ({
          id: m.id,
          name: m.nome,
          phone: m.telefone || "",
          commissionPercent: Number(m.percentual_comissao || 0)
        }));
      }

      // 3. Produtos
      const { data: prodsData } = await client.from("produtos").select("*");
      if (prodsData && prodsData.length > 0) {
        state.products = prodsData.map(p => ({
          id: p.id,
          code: p.codigo,
          name: p.nome,
          description: p.descricao || "",
          stockQty: Number(p.estoque_atual || 0),
          unit: p.unidade || "un",
          price: Number(p.preco_venda || 0)
        }));
      }

      // 4. Agenda
      const { data: apptsData } = await client.from("agenda").select("*");
      if (apptsData && apptsData.length > 0) {
        state.appointments = apptsData.map(a => ({
          id: a.id,
          client: a.cliente_nome,
          phone: a.telefone || "",
          vehicle: a.veiculo || "",
          plate: a.placa || "",
          color: a.cor || "",
          date: a.data_agendada,
          time: a.hora_agendada ? String(a.hora_agendada).slice(0, 5) : "08:00",
          mechanic: a.mecanico_nome || "",
          service: a.servico_previsto || ""
        }));
      }

      // 5. Ordens de Serviço & Itens
      const { data: osData } = await client.from("ordens_servico").select("*, os_itens(*)").order("numero", { ascending: false });
      if (osData && osData.length > 0) {
        let maxSeq = 0;
        state.orders = osData.map(o => {
          const num = Number(o.numero);
          if (num > maxSeq) maxSeq = num;
          const osIdStr = String(num).padStart(4, "0");

          const services = (o.os_itens || [])
            .filter(i => i.tipo === "servico")
            .map(i => ({ name: i.descricao, value: Number(i.valor_unitario || 0) }));
          const parts = (o.os_itens || [])
            .filter(i => i.tipo === "peca")
            .map(i => ({ name: i.descricao, value: Number(i.valor_unitario || 0) }));

          const sit = o.status;
          const normSit = String(sit || "").toLowerCase();
          const key = normSit.includes("concl") ? "done" : (sit === "Paga" ? "paid" : (sit === "Em andamento" ? "progress" : "open"));

          return {
            dbId: o.id,
            id: osIdStr,
            client: o.cliente_nome,
            phone: o.telefone || "",
            plate: o.placa || "",
            vehicle: o.veiculo || "",
            color: o.cor || "",
            mechanic: o.mecanico_nome || "A definir",
            status: sit,
            statusKey: key,
            value: Number(o.valor_total || 0),
            openedAt: o.data_abertura,
            km: o.km ? String(o.km) : "",
            complaint: o.relato_cliente || "",
            paid: Boolean(o.pago),
            paymentMethod: o.forma_pagamento || "Pix",
            services,
            parts
          };
        });
        if (maxSeq > state.sequence) state.sequence = maxSeq;
      }

      // 6. Contas a Pagar
      const { data: finData } = await client.from("financeiro_movimentacoes").select("*").eq("tipo", "pagar");
      if (finData && finData.length > 0) {
        state.payables = finData.map(p => ({
          id: p.id,
          description: p.descricao,
          category: p.categoria || "Geral",
          dueDate: p.vencimento || "",
          value: Number(p.valor || 0),
          paid: p.status === "pago"
        }));
      }

      // 7. Comissões
      const { data: comsData } = await client.from("comissoes").select("*, ordens_servico(numero)");
      if (comsData && comsData.length > 0) {
        state.commissions = comsData.map(c => ({
          id: c.id,
          mechanic: c.mecanico_nome,
          orderId: c.ordens_servico?.numero ? String(c.ordens_servico.numero).padStart(4, "0") : String(c.os_id),
          osDbId: c.os_id,
          value: Number(c.valor || 0),
          paid: Boolean(c.pago)
        }));
      }

      callRenderAll();
      console.info("[BOAMEC] Dados sincronizados com Supabase com sucesso.");
    } catch (err) {
      console.error("[BOAMEC] Erro ao carregar dados do Supabase:", err);
    }
  }

  // Sync escritas

  async function syncSaveClient(clientObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      const { data: existing } = await client
        .from("clientes")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("nome", clientObj.name)
        .maybeSingle();

      let clientId = existing?.id;

      if (clientId) {
        await client
          .from("clientes")
          .update({
            telefones: clientObj.phones || [],
            endereco: clientObj.address || ""
          })
          .eq("id", clientId);
      } else {
        const { data: inserted } = await client
          .from("clientes")
          .insert({
            empresa_id: empresaId,
            nome: clientObj.name,
            telefones: clientObj.phones || [],
            endereco: clientObj.address || ""
          })
          .select("id")
          .single();
        clientId = inserted?.id;
      }

      // Salva veículos do cliente
      if (clientId && clientObj.vehicles?.length) {
        for (const v of clientObj.vehicles) {
          await client
            .from("veiculos")
            .upsert({
              empresa_id: empresaId,
              cliente_id: clientId,
              placa: v.plate,
              modelo: v.name,
              cor: v.color || ""
            }, { onConflict: "empresa_id,placa" });
        }
      }
    } catch (err) {
      console.error("[BOAMEC] Erro ao salvar cliente no Supabase:", err);
    }
  }

  async function syncSaveMechanic(mechanicObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      await client.from("mecanicos").upsert({
        empresa_id: empresaId,
        nome: mechanicObj.name,
        telefone: mechanicObj.phone || "",
        percentual_comissao: mechanicObj.commissionPercent || 20
      }, { onConflict: "empresa_id,nome" });
    } catch (err) {
      console.error("[BOAMEC] Erro ao salvar mecânico no Supabase:", err);
    }
  }

  async function syncSaveProduct(productObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      await client.from("produtos").upsert({
        empresa_id: empresaId,
        codigo: productObj.code,
        nome: productObj.name,
        descricao: productObj.description || "",
        unidade: productObj.unit || "un",
        estoque_atual: productObj.stockQty || 0,
        preco_venda: productObj.price || 0
      }, { onConflict: "empresa_id,codigo" });
    } catch (err) {
      console.error("[BOAMEC] Erro ao salvar produto no Supabase:", err);
    }
  }

  async function syncSaveAppointment(apptObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      await client.from("agenda").insert({
        empresa_id: empresaId,
        cliente_nome: apptObj.client,
        telefone: apptObj.phone || "",
        veiculo: apptObj.vehicle || "",
        placa: apptObj.plate || "",
        cor: apptObj.color || "",
        data_agendada: apptObj.date,
        hora_agendada: apptObj.time,
        mecanico_nome: apptObj.mechanic || "",
        servico_previsto: apptObj.service || "",
        status: "agendado"
      });
    } catch (err) {
      console.error("[BOAMEC] Erro ao salvar agendamento no Supabase:", err);
    }
  }

  async function syncSaveOrder(orderObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      const num = Number(orderObj.id);
      const laborValue = (orderObj.services || []).reduce((s, x) => s + Number(x.value || 0), 0);
      const partsValue = (orderObj.parts || []).reduce((s, x) => s + Number(x.value || 0), 0);

      // Upsert na tabela ordens_servico
      const { data: osData, error: osErr } = await client
        .from("ordens_servico")
        .upsert({
          empresa_id: empresaId,
          numero: num,
          cliente_nome: orderObj.client,
          telefone: orderObj.phone || "",
          veiculo: orderObj.vehicle || "",
          placa: orderObj.plate || "",
          cor: orderObj.color || "",
          km: Number(orderObj.km) || null,
          relato_cliente: orderObj.complaint || "",
          status: orderObj.status || "Aberta",
          valor_mao_obra: laborValue,
          valor_pecas: partsValue,
          valor_total: orderObj.value || (laborValue + partsValue),
          pago: Boolean(orderObj.paid),
          forma_pagamento: orderObj.paymentMethod || null
        }, { onConflict: "empresa_id,numero" })
        .select("id")
        .single();

      if (osErr || !osData?.id) {
        console.error("[BOAMEC] Erro ao gravar OS principal:", osErr);
        return;
      }

      const osDbId = osData.id;
      orderObj.dbId = osDbId;

      // Apaga e reinsere itens de OS
      await client.from("os_itens").delete().eq("os_id", osDbId);

      const itemsToInsert = [
        ...(orderObj.services || []).map(s => ({
          empresa_id: empresaId,
          os_id: osDbId,
          tipo: "servico",
          descricao: s.name,
          quantidade: 1,
          valor_unitario: Number(s.value || 0)
        })),
        ...(orderObj.parts || []).map(p => ({
          empresa_id: empresaId,
          os_id: osDbId,
          tipo: "peca",
          descricao: p.name,
          quantidade: 1,
          valor_unitario: Number(p.value || 0)
        }))
      ];

      if (itemsToInsert.length > 0) {
        await client.from("os_itens").insert(itemsToInsert);
      }

      // Gera/Atualiza comissão do mecânico (20% por padrão sobre mão de obra)
      if (orderObj.mechanic && orderObj.mechanic !== "A definir" && laborValue > 0) {
        const commValue = laborValue * 0.20;
        await client.from("comissoes").upsert({
          empresa_id: empresaId,
          os_id: osDbId,
          mecanico_nome: orderObj.mechanic,
          percentual: 20,
          valor_base: laborValue,
          valor: commValue,
          pago: Boolean(orderObj.paid)
        });
      }

    } catch (err) {
      console.error("[BOAMEC] Erro ao salvar OS no Supabase:", err);
    }
  }

  async function syncReceiveOrder(orderObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      const num = Number(orderObj.id);

      // Atualiza OS para Paga
      await client
        .from("ordens_servico")
        .update({
          pago: true,
          status: "Paga",
          forma_pagamento: orderObj.paymentMethod || "Pix",
          data_pagamento: new Date().toISOString()
        })
        .eq("empresa_id", empresaId)
        .eq("numero", num);

      // Registra movimentação financeira de recebimento
      await client.from("financeiro_movimentacoes").insert({
        empresa_id: empresaId,
        tipo: "receber",
        descricao: `Recebimento OS #${orderObj.id} - ${orderObj.client}`,
        categoria: "Ordem de Serviço",
        valor: Number(orderObj.value || 0),
        valor_pago: Number(orderObj.value || 0),
        forma_pagamento: orderObj.paymentMethod || "Pix",
        status: "pago",
        data_pagamento: new Date().toISOString()
      });

    } catch (err) {
      console.error("[BOAMEC] Erro ao registrar recebimento no Supabase:", err);
    }
  }

  async function syncPayPayable(payableId) {
    try {
      await client
        .from("financeiro_movimentacoes")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString()
        })
        .eq("id", payableId);
    } catch (err) {
      console.error("[BOAMEC] Erro ao pagar conta no Supabase:", err);
    }
  }

  async function syncPayCommissions(ids) {
    try {
      for (const commId of ids) {
        await client
          .from("comissoes")
          .update({
            pago: true,
            data_pagamento: new Date().toISOString()
          })
          .eq("id", commId);
      }
    } catch (err) {
      console.error("[BOAMEC] Erro ao pagar comissões no Supabase:", err);
    }
  }

  async function syncSaveCompany(companyObj) {
    const empresaId = getEmpresaId();
    if (!empresaId) return;

    try {
      await client
        .from("empresas")
        .update({
          razao_social: companyObj.legalName,
          nome_fantasia: companyObj.tradeName,
          telefone: companyObj.phone,
          endereco: companyObj.address
        })
        .eq("id", empresaId);
    } catch (err) {
      console.error("[BOAMEC] Erro ao atualizar empresa no Supabase:", err);
    }
  }

  /* ─────────────────────────────────────────────
     10. Listener de mudança de estado de auth
  ───────────────────────────────────────────── */
  let _sessionInitialized = false;

  client.auth.onAuthStateChange(async (event, session) => {
    console.info("[BOAMEC] Auth state change:", event, session?.user?.email || "sem usuario");

    if (event === "SIGNED_OUT") {
      _sessionInitialized = false;
      window.BOAMEC_BACKEND.user = null;
      window.BOAMEC_BACKEND.profile = null;
      window.BOAMEC_BACKEND.company = null;
      window.BOAMEC_BACKEND.subscription = null;
      return;
    }

    // SIGNED_IN é disparado pelo Supabase quando o #access_token da URL é processado (OAuth)
    // ou quando uma sessão salva no localStorage é restaurada
    if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
      if (_sessionInitialized) return; // Evita chamadas duplicadas
      _sessionInitialized = true;

      window.BOAMEC_BACKEND.user = session.user;

      const { profile, company, subscription } = await fetchProfileAndCompany(session.user.id);

      cleanAuthUrl();

      if (!profile) {
        showOnboarding();
        return;
      }

      if (!checkSubscriptionBlock(subscription)) {
        await client.auth.signOut();
        return;
      }

      applyProfileToAppState(profile, company, subscription);
      callShowApp();
      callSetScreen("home");
    }
  });

  /* ─────────────────────────────────────────────
     11. Processamento de retorno OAuth
  ───────────────────────────────────────────── */
  async function processOAuthCallback() {
    let sessionData = null;
    let attempts = 0;
    const maxAttempts = 10; // até 3 segundos de espera (10 x 300ms)

    while (attempts < maxAttempts) {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.error("[BOAMEC] Erro ao obter sessão OAuth:", error.message);
        cleanAuthUrl();
        callShowLogin(`Erro de autenticação: ${error.message}`);
        return;
      }
      if (data?.session?.user) {
        sessionData = data;
        break;
      }
      attempts++;
      await new Promise(r => setTimeout(r, 300));
    }

    cleanAuthUrl();

    if (!sessionData?.session?.user) {
      console.warn("[BOAMEC] Sessão OAuth não encontrada.");
      callShowLogin("Não foi possível autenticar com o Google. Tente novamente.");
      return;
    }

    const user = sessionData.session.user;
    window.BOAMEC_BACKEND.user = user;
    _sessionInitialized = true;

    console.info("[BOAMEC] Sessão OAuth obtida para:", user.email);

    const { profile, company, subscription } = await fetchProfileAndCompany(user.id);

    if (!profile) {
      console.info("[BOAMEC] Usuário novo - exibindo onboarding.");
      showOnboarding();
      return;
    }

    if (!checkSubscriptionBlock(subscription)) {
      await client.auth.signOut();
      return;
    }

    applyProfileToAppState(profile, company, subscription);
    callShowApp();
    callSetScreen("home");
  }


  function init() {
    const googleBtn = document.querySelector("[data-action='google-login']");
    if (googleBtn) googleBtn.classList.remove("hidden");

    // Substitui o loginWithGoogle placeholder do app.js pelo real com Supabase
    window.loginWithGoogle = async function () {
      showLogin("Abrindo login do Google...");
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) showLogin(`Não foi possível abrir o login do Google: ${error.message || "verifique o provedor no Supabase"}.`);
    };

    bindOnboardingEvents();
    console.info("[BOAMEC] Backend Supabase ativo.");
    window.BOAMEC_BACKEND._ready = true;

    // Se NÃO for um retorno OAuth (URL sem #access_token), verifica sessão salva normalmente
    // Para retornos OAuth, o onAuthStateChange cuida de tudo ao processar o token da URL
    const isOAuth = window.location.hash.includes("access_token=") || window.location.search.includes("code=");
    if (isOAuth) {
      console.info("[BOAMEC] Retorno OAuth detectado. Processando...");
      processOAuthCallback();
    } else {
      loadSession();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
