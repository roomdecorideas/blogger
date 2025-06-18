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
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const intervalHours = document.getElementById('interval-hours');

    // Store file SHAs for updates
    let fileSHAs = {};

    // Helper function to call GitHub API
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
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
            }
            // Some responses have no content (e.g., 204 No Content)
            if (response.status === 204) {
                return {};
            }
            return await response.json();
        } catch (error) {
            logStatus(`Error: ${error.message}`, true);
            console.error(error);
            return null;
        }
    }
    
    // Helper untuk log status
    function logStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#dc3545' : '#212529';
    }

    // Helper untuk mengubah string ke Base64 (diperlukan GitHub API)
    function toBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }
    
    // Helper untuk mengubah Base64 ke string
    function fromBase64(str) {
        return decodeURIComponent(escape(atob(str)));
    }
    
    // --- Tombol Load Pengaturan ---
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
                fileSHAs[filename] = data.sha; // Simpan SHA untuk update
                logStatus(`Loaded ${filename}...`);
            } else {
                logStatus(`Gagal memuat ${filename}. Apakah file ada di repo?`, true);
                success = false;
                break;
            }
        }
        
        // Load state.json
        const stateData = await githubApi('/contents/state.json');
        if(stateData && stateData.content){
            const state = JSON.parse(fromBase64(stateData.content));
            startDate.value = state.startDate;
            endDate.value = state.endDate;
            intervalHours.value = state.publishIntervalHours;
            fileSHAs['state.json'] = stateData.sha;
            logStatus('Loaded state.json...');
        } else {
             logStatus(`Gagal memuat state.json.`, true);
             success = false;
        }

        if (success) {
            logStatus('Semua pengaturan berhasil dimuat!');
            botSettingsDiv.style.display = 'block';
        }
    });

    // --- Tombol Simpan Pengaturan ---
    saveBtn.addEventListener('click', async () => {
        logStatus('Menyimpan pengaturan ke GitHub...');
        
        // Update keyword.txt
        await updateFile('keyword.txt', keywordList.value, 'Update keywords via Control Panel');
        
        // Update email.txt
        await updateFile('email.txt', bloggerEmail.value, 'Update blogger email via Control Panel');

        // Update state.json
        const newState = {
            lastPostedIndex: -1, // Reset saat pengaturan disimpan
            startDate: startDate.value,
            endDate: endDate.value,
            publishIntervalHours: parseInt(intervalHours.value, 10)
        };
        await updateFile('state.json', JSON.stringify(newState, null, 2), 'Update state via Control Panel');

        logStatus('Semua pengaturan berhasil disimpan ke repository GitHub!');
    });
    
    async function updateFile(path, content, message) {
        const body = {
            message: message,
            content: toBase64(content),
            sha: fileSHAs[path] // SHA wajib ada untuk update file
        };
        const result = await githubApi(`/contents/${path}`, 'PUT', body);
        if(result && result.content) {
            fileSHAs[path] = result.content.sha; // Update SHA setelah berhasil
        }
    }
    
    // --- Tombol Jalankan Manual ---
    runBtn.addEventListener('click', async () => {
        if (!confirm('Anda yakin ingin menjalankan proses posting 1x secara manual?')) return;
        
        logStatus('Mengirim perintah untuk menjalankan workflow...');
        const result = await githubApi('/actions/workflows/blogger_post.yml/dispatches', 'POST', {
            ref: 'main' // Ganti 'main' jika nama branch utama Anda berbeda
        });

        if (result !== null) {
            logStatus('Perintah berhasil dikirim! Cek tab "Actions" di repository GitHub Anda untuk melihat prosesnya.');
        }
    });
});
