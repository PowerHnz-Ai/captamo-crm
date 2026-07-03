// Usando Firebase via script tags (compat) - auth.html carrega os scripts
(function() {
  function getAppBasePath() {
    const path = window.location.pathname || '/';
    const cleaned = path.replace(/(?:index|auth)\.html$/i, '').replace(/auth\/?$/i, '');
    return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
  }

  function getAppRoute(route) {
    const fileName = route === 'auth' ? 'auth.html' : 'index.html';
    if (window.location.protocol === 'file:') {
      return new URL(fileName, window.location.href).href;
    }

    const base = getAppBasePath();
    return route === 'auth' ? `${base}auth` : base;
  }

  function navigateToRoute(route) {
    window.location.href = getAppRoute(route);
  }

  function normalizeCanonicalUrl() {
    if (window.location.protocol === 'file:') return;

    const pathname = window.location.pathname || '/';
    let canonicalPath = null;

    if (/\/index\.html$/i.test(pathname)) {
      canonicalPath = pathname.replace(/index\.html$/i, '');
    } else if (/\/auth\.html$/i.test(pathname)) {
      canonicalPath = pathname.replace(/auth\.html$/i, 'auth');
    }

    if (canonicalPath == null) return;
    if (canonicalPath === '') canonicalPath = '/';

    const normalized = canonicalPath + window.location.search + window.location.hash;
    window.history.replaceState(null, '', normalized);
  }

  normalizeCanonicalUrl();

  if (typeof firebase === 'undefined' || !firebase.apps?.length) {
    const errorEl = document.getElementById('authError');
    if (errorEl) {
      errorEl.textContent = 'Falha ao carregar autenticacao. Atualize a pagina e tente novamente.';
    }
    return;
  }

  const auth = firebase.auth();
  let isRegistering = false;

  function escapeDialogText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }

  function showAuthDialog(message, options = {}) {
    return new Promise((resolve) => {
      const title = options.title || 'Aviso';
      const confirmText = options.confirmText || 'OK';
      const tone = options.tone || 'info';
      const toneMap = {
        info: { border: 'var(--accent)' },
        warning: { border: '#f59e0b' },
        danger: { border: '#ef4444' },
        success: { border: '#22c55e' }
      };
      const activeTone = toneMap[tone] || toneMap.info;

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '2100';
      overlay.style.background = 'rgba(2, 6, 23, 0.72)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.padding = '16px';
      overlay.innerHTML = `
        <div style="width:min(100%,420px);background:var(--bg-card);border:1px solid ${activeTone.border};border-radius:16px;padding:20px;box-shadow:0 18px 40px rgba(0,0,0,0.35);">
          <h3 style="margin:0 0 10px 0;font-size:1rem;font-weight:700;color:var(--text-primary);">${escapeDialogText(title)}</h3>
          <p style="margin:0 0 16px 0;color:var(--text-secondary);font-size:0.92rem;line-height:1.45;">${escapeDialogText(message)}</p>
          <div style="display:flex;justify-content:flex-end;">
            <button type="button" data-auth-dialog-ok style="border:none;background:var(--accent);color:#fff;border-radius:10px;min-height:40px;padding:0 16px;font-family:inherit;font-size:0.9rem;font-weight:700;cursor:pointer;">${escapeDialogText(confirmText)}</button>
          </div>
        </div>
      `;

      const cleanup = () => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
      };

      const close = () => {
        cleanup();
        resolve(true);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') close();
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });

      overlay.querySelector('[data-auth-dialog-ok]')?.addEventListener('click', close);
      document.addEventListener('keydown', onKeyDown);
      document.body.appendChild(overlay);
    });
  }

  function generateCompanyCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      // Durante o cadastro, aguardamos persistir os dados no Firestore antes de navegar.
      if (isRegistering) return;
      navigateToRoute('home');
    }
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('loginForm').style.display = tab.dataset.tab === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = tab.dataset.tab === 'register' ? 'block' : 'none';
      document.getElementById('authError').textContent = '';
      document.getElementById('registerError').textContent = '';
    });
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');
    try {
      errorEl.textContent = '';
      await firebase.auth().signInWithEmailAndPassword(email, password);
      navigateToRoute('home');
    } catch (err) {
      errorEl.textContent = err.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : err.message;
    }
  });

  // Alternar campos de empresa conforme tipo de conta
  const companyNameGroup = document.getElementById('companyNameGroup');
  const companyCodeGroup = document.getElementById('companyCodeGroup');
  document.querySelectorAll('input[name="registerAccountType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'companyAdmin') {
        companyNameGroup.style.display = 'block';
        companyCodeGroup.style.display = 'none';
      } else {
        companyNameGroup.style.display = 'none';
        companyCodeGroup.style.display = 'block';
      }
    });
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const accountType = document.querySelector('input[name="registerAccountType"]:checked')?.value || 'companyAdmin';
    const companyName = document.getElementById('registerCompanyName').value.trim();
    const companyCode = document.getElementById('registerCompanyCode').value.trim();
    const errorEl = document.getElementById('registerError');
    try {
      isRegistering = true;
      errorEl.textContent = '';
      if (accountType === 'companyAdmin' && !companyName) {
        errorEl.textContent = 'Informe o nome da empresa.';
        isRegistering = false;
        return;
      }
      if (accountType === 'companyMember' && !companyCode) {
        errorEl.textContent = 'Informe o código da empresa enviado pelo administrador.';
        isRegistering = false;
        return;
      }

      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = cred.user;

      const db = firebase.firestore();
      let companyId = null;
      let role = 'member';

      if (accountType === 'companyAdmin') {
        // Cria empresa com código curto de 6 caracteres como ID do documento
        let created = false;
        let attempts = 0;
        while (!created && attempts < 5) {
          attempts++;
          const code = generateCompanyCode(6);
          const ref = db.collection('companies').doc(code);
          const snap = await ref.get();
          if (!snap.exists) {
            await ref.set({
              name: companyName,
              createdBy: user.uid,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            companyId = ref.id;
            created = true;
          }
        }

        if (!created) {
          throw new Error('Não foi possível gerar um código de empresa único. Tente novamente.');
        }

        role = 'admin';
      } else {
        // Entrar em empresa existente por código (6 caracteres)
        const code = companyCode.toUpperCase();
        const companyRef = await db.collection('companies').doc(code).get();
        if (!companyRef.exists) {
          errorEl.textContent = 'Código de empresa inválido. Confira com o administrador.';
          await user.delete();
          return;
        }
        companyId = companyRef.id;
        role = 'member';
      }

      // Perfil do usuário
      await db.collection('users').doc(user.uid).set({
        name,
        email,
        companyId,
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Para administradores, mostramos o código da empresa e tentamos copiar automaticamente
      if (role === 'admin') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(companyId);
          }
        } catch (_) {
          // Se falhar, apenas seguimos com o alerta
        }
        await showAuthDialog(
          `Empresa criada com sucesso!\n\nCodigo da empresa: ${companyId}\n\nO codigo foi copiado para a area de transferencia.\nCompartilhe este codigo com os colaboradores para que eles se cadastrem.`,
          { title: 'Empresa criada', tone: 'success' }
        );
      }

      navigateToRoute('home');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        errorEl.textContent = 'Este e-mail já está cadastrado.';
      } else if (err.code === 'auth/weak-password') {
        errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      } else {
        errorEl.textContent = err.message;
      }
    } finally {
      isRegistering = false;
    }
  });
})();
