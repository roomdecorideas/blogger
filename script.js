document.addEventListener('DOMContentLoaded', function() {
    // Elemen DOM
    const tokenInput = document.getElementById('github-token');
    const repoInput = document.getElementById('repo-name');
    const loadBtn = document.getElementById('load-btn');
    const saveBtn = document.getElementById('save-btn');
    const runBtn = document.getElementById('run-btn');
    const statusDiv = document.getElementById('status');
    const botSettingsDiv = document.getElementById('bot-settings');

    const keywordList = document.getElementById('keyword-list');
    const bloggerEmail = document.getElementById('blogger-email');

    function loadGitHubSettingsFromStorage() {
        const savedToken = localStorage.getItem('githubApiToken');
        const savedRepo = localStorage.getItem('githubRepoName');
        if (savedToken) tokenInput.value = savedToken;
        if (savedRepo) repoInput.value = savedRepo;
    }

    tokenInput.addEventListener('input', () => { localStorage.setItem('githubApiToken', tokenInput.value); });
    repoInput.addEventListener('input', () => { localStorage.setItem('githubRepoName', repoInput.value); });
    
    loadGitHubSettingsFromStorage();

    let fileSHAs = {};

    async function githubApi(endpoint, method = 'GET', body = null) {
        const token = tokenInput.value;
        const repo = repoInput.value;
        if (!token || !repo) {
            logStatus('Error: Token dan Nama Repo harus diisi.', true);
            return null;
        }
        const url = `https://api.github.com/repos/${repo}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
            if (response.status === 204) return {};
            return await response.json();
        } catch (error) {
            logStatus(`Error: ${error.message}`, true);
            return null;
        }
    }
    
    function logStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#dc3545' : '#212529';
    }

    function toBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
    function fromBase64(str) { return decodeURIComponent(escape(atob(str))); }
    
    loadBtn.addEventListener('click', async () => {
        logStatus('Loading data from repository...');
        
        const filesToLoad = {
            'keyword.txt': keywordList,
            'email.txt': bloggerEmail,
        };

        let success = true;
        for (const [filename, element] of Object.entries(filesToLoad)) {
            const data = await githubApi(`/contents/${filename}`);
            if (data && data.content) {
                element.value = fromBase64(data.content);
                fileSHAs[filename] = data.sha;
                logStatus(`Loaded ${filename}...`);
            } else {
                logStatus(`Gagal memuat ${filename}.`, true);
                success = false;
                break;
            }
        }
        
        // Simpan juga SHA untuk state.json
        const stateData = await githubApi('/contents/state.json');
        if (stateData) {
            fileSHAs['state.json'] = stateData.sha;
        } else {
            success = false;
        }

        if (success) {
            logStatus('Pengaturan berhasil dimuat!');
            botSettingsDiv.style.display = 'block';
        }
    });

    saveBtn.addEventListener('click', async () => {
        logStatus('Menyimpan pengaturan ke GitHub...');
        await updateFile('keyword.txt', keywordList.value, 'Update keywords via Control Panel');
        await updateFile('email.txt', bloggerEmail.value, 'Update blogger email via Control Panel');
        logStatus('Pengaturan Keyword & Email berhasil disimpan!');
    });
    
    async function updateFile(path, content, message) {
        const body = { message, content: toBase64(content), sha: fileSHAs[path] };
        const result = await githubApi(`/contents/${path}`, 'PUT', body);
        if(result && result.content) {
            fileSHAs[path] = result.content.sha;
        }
    }
    
    runBtn.addEventListener('click', async () => {
        if (!confirm('Anda yakin ingin menjalankan proses posting 1x secara manual?')) return;
        logStatus('Mengirim perintah untuk menjalankan workflow...');
        const result = await githubApi('/actions/workflows/blogger_post.yml/dispatches', 'POST', { ref: 'main' });
        if (result !== null) {
            logStatus('Perintah berhasil dikirim! Cek tab "Actions" di repository GitHub Anda.');
        }
    });
});
