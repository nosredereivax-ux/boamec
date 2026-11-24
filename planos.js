(() => {
  const feedback = document.getElementById("payment-feedback");
  const error = document.getElementById("plans-error");
  const buttons = [...document.querySelectorAll("[data-plan]")];
  const messages = {
    sucesso: ["success", "Pagamento aprovado. Seu acesso será atualizado assim que o Mercado Pago confirmar a transação."],
    pendente: ["pending", "Pagamento pendente. O acesso será liberado após a confirmação do Mercado Pago."],
    falha: ["failure", "Não foi possível confirmar o pagamento ou seu período de acesso expirou. Escolha um plano para continuar."],
  };
  const result = messages[new URLSearchParams(location.search).get("pagamento")];
  if (result) {
    feedback.className = `payment-feedback ${result[0]}`;
    feedback.textContent = result[1];
    feedback.hidden = false;
  }

  const config = window.BOAMEC_CONFIG || {};
  if (!window.supabase?.createClient || !config.supabaseUrl || !config.supabaseAnonKey) {
    error.textContent = "Não foi possível carregar a sessão do sistema. Volte ao BOAMEC e tente novamente.";
    return;
  }

  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  let checkoutContext;

  async function prepareCheckout() {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session?.user) {
      error.textContent = "Entre na sua conta BOAMEC antes de contratar um plano.";
      return;
    }
    const { data: profile, error: profileError } = await client
      .from("usuarios")
      .select("empresa_id")
      .eq("id", session.user.id)
      .single();
    if (profileError || !profile?.empresa_id) {
      error.textContent = "Não foi possível localizar a empresa vinculada à sua conta.";
      return;
    }
    checkoutContext = { token: session.access_token, empresa_id: profile.empresa_id, email: session.user.email };
    buttons.forEach((button) => { button.disabled = false; });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!checkoutContext || button.disabled) return;
      error.textContent = "";
      buttons.forEach((item) => { item.disabled = true; });
      button.textContent = "Conectando ao Mercado Pago…";
      try {
        const response = await fetch("/api/mercadopago/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${checkoutContext.token}` },
          body: JSON.stringify({ ...checkoutContext, plano: button.dataset.plan }),
        });
        const data = await response.json();
        if (!response.ok || !data.init_point) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
        location.assign(data.init_point);
      } catch (checkoutError) {
        error.textContent = checkoutError.message || "Não foi possível iniciar o pagamento.";
        buttons.forEach((item) => { item.disabled = false; });
        button.textContent = button.dataset.plan === "anual" ? "Assinar Plano Anual" : "Assinar Plano Mensal";
      }
    });
  });

  prepareCheckout().catch(() => {
    error.textContent = "Não foi possível validar sua sessão. Volte ao BOAMEC e tente novamente.";
  });
})();
