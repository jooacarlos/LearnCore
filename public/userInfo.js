export async function carregarUsuario(logoutRedirectUrl = '/public/loginAluno.html') {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = logoutRedirectUrl;
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const res = await fetch('http://localhost:3000/api/users/me', { headers });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = logoutRedirectUrl;
                return;
            }
            throw new Error('Erro ao carregar usuário');
        }

        const user = await res.json();
        const nomeCompleto = `${user.data.firstName} ${user.data.lastName}`;
        const avatarPath = user.data.avatar?.replace(/\\/g, '/');

        // Atualiza nome
        const nomeEl = document.getElementById('alunoName');
        if (nomeEl) nomeEl.textContent = nomeCompleto;

        // Atualiza avatar
        const avatarEl = document.querySelector('.user-profile img');
        if (avatarEl && avatarPath) {
            avatarEl.src = `http://localhost:3000/${avatarPath}`;
        }

        return user.data;
    } catch (err) {
        console.error('Erro ao carregar dados do usuário:', err);
        localStorage.removeItem('token');
        window.location.href = logoutRedirectUrl;
    }
}
