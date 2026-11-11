async function openAlbum(id){currentAlbum=await api('/api/discos/'+id);$('albumTitle').textContent='💿 '+currentAlbum.nombre;go('albumPane');let ss=await api('/api/discos/'+id+'/canciones');$('albumSongs').innerHTML=ss.map(songRow).join('')||'<p class="muted">Disco vacío.</p>'}function songRow(s){return `<div class="item"><b>♫ ${esc(s.titulo)}</b><button onclick="openSong('${s.id}')">Producción</button></div>`}async function openSong(id){currentSong=await api('/api/canciones/'+id);$('songHeading').textContent=currentSong.titulo;go('songPane');let stages=await api('/api/canciones/'+id+'/etapas');$('stages').innerHTML=stages.map(s=>`<div class="card"><h3>${esc(s.etapa)}</h3><div class="row"><button onclick="newSession('${s.etapa}')">Nueva sesión</button></div><label class="drop-zone" data-attachment="${s.adjuntos}">Arrastrá archivos acá o elegilos<input type="file" multiple><span class="file-status" role="status"></span></label><div class="list">${s.sesiones.map(x=>`<div class="item"><div><b>${esc(x.daw||'Archivo')}</b><div class="muted">${esc(x.ruta)} ${esc(x.comentario)}</div></div><button class="alt" onclick="version('${x.id}')">Nueva versión</button></div>`).join('')}</div></div>`).join(''); bindAttachments(id)}async function newSession(stage){let daw=prompt('DAW (Cubase, REAPER, WaveLab u otro)');if(!daw)return;let path=prompt('Ubicación de carpeta de sesión. Dejá vacío para crearla dentro del artista.','');let comment=prompt('Notas o cambios iniciales:')||'';try{await api('/api/canciones/'+currentSong.id+'/sesiones',body({etapa:stage,daw,ruta:path,comentario:comment}));openSong(currentSong.id)}catch(e){alert(e.message)}}async function version(id){let comentario=prompt('Describe los cambios de esta versión:')||'';try{await api('/api/sesiones/'+id+'/versiones',body({comentario}));openSong(currentSong.id)}catch(e){alert(e.message)}}
const $ = id => document.getElementById(id);
let artist, currentAlbum, currentSong, editing, photo, selectedPhoto;
let previewUrl;
const pages = ['home', 'manager', 'profile', 'editor', 'artistPane', 'albumPane', 'songPane', 'arrangements', 'composition', 'beats', 'scores', 'lyrics'];
const trail = ['home'];
function display() {
    const page = trail.at(-1);
    const visible = page === 'projectManager' ? 'manager' : page;
    pages.forEach(id => { $(id).hidden = id !== visible; });
    $('nav').hidden = page === 'home';
    $('sideHome').setAttribute('aria-current', page === 'home' ? 'page' : 'false');
    $('sideArtists').setAttribute('aria-current', ['home', 'arrangements', 'composition', 'beats', 'scores', 'lyrics'].includes(page) ? 'false' : 'page');
    $('sideArrangements').setAttribute('aria-current', page === 'arrangements' ? 'page' : 'false');
    $('sideComposition').setAttribute('aria-current', ['composition', 'beats', 'scores', 'lyrics'].includes(page) ? 'page' : 'false');
    if (page !== 'arrangements') $('takePlayer').pause();
    const projectPath = trail.includes('projectManager');
    const manager = projectPath ? 'Gestión de proyectos' : 'Gestión de artistas';
    const artistLabel = ['profile', 'artistPane', 'editor', 'songPane'].includes(page) && artist ? ' › ' + esc(artist.nombre) : '';
    $('crumbPath').innerHTML = `<button onclick="go('home')">Inicio</button> › <button onclick="openArtistManager(${projectPath})">${manager}</button>${artistLabel}`;
    if (page === 'arrangements') $('crumbPath').innerHTML = '<button onclick="go(\'home\')">Inicio</button> › Arreglos';
    const compositionLabels = {composition: 'Composición', beats: 'Beats', scores: 'Partituras', lyrics: 'Letras'};
    if (compositionLabels[page]) {
        const current = compositionLabels[page];
        $('crumbPath').innerHTML = `<button onclick="go('home')">Inicio</button> › <button onclick="go('composition')">Composición</button>${page === 'composition' ? '' : ' › ' + current}`;
    }
    $('error').textContent = '';
    window.scrollTo(0, 0);
    if (page === 'profile' && artist) renderProfile();
    if (page === 'beats') loadBeats();
    if (page === 'scores') loadScores();
    if (page === 'lyrics') loadLyrics();
    if (visible === 'manager') {
        const projects = page === 'projectManager';
        $('managerTitle').textContent = projects ? 'Gestión de proyectos por artistas' : 'Gestión de artistas';
        $('managerDescription').textContent = projects ? 'Elegí un artista para gestionar sus discos y canciones.' : 'Buscá un artista para consultar o modificar su ficha.';
        loadLibrary();
    }
}
function go(page) {
    if (page === 'home') trail.splice(1);
    else if (trail.at(-1) !== page) trail.push(page);
    display();
}
function back() {
    if (trail.length > 1) trail.pop();
    display();
}
async function api(url, options = {}) {
    const response = await fetch(url, {headers: {'Content-Type': 'application/json'}, ...options});
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'No se pudo completar la operación.');
    }
    return response.json();
}
const body = data => ({method: 'POST', body: JSON.stringify(data)});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
function report(error) { $('error').textContent = error.message; }
window.addEventListener('unhandledrejection', event => report(event.reason));
// El modo de vista se conserva mientras la ventana está abierta.
let compactArtists = false;
let searchSequence = 0;
function openArtistManager(projects = false) {
    trail.splice(1);
    go(projects ? 'projectManager' : 'manager');
}
function setArtistView(compact) {
    compactArtists = compact;
    $('library').classList.toggle('compact', compact);
    $('artistGrid').setAttribute('aria-pressed', !compact);
    $('artistList').setAttribute('aria-pressed', compact);
}
function artistInitials(name) {
    return esc(name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase());
}
function artistTotals(row) {
    return countLabel(row.discos ?? 0, 'disco', 'discos') + ' · ' + countLabel(row.canciones ?? 0, 'canción', 'canciones');
}
async function loadLibrary() {
    const sequence = ++searchSequence;
    const page = trail.at(-1);
    const projects = page === 'projectManager';
    const query = $('query').value.trim();
    $('query').placeholder = projects ? 'Buscar artista, disco o canción…' : 'Buscar artista, grupo o banda…';
    try {
        let rows = await api('/api/biblioteca?q=' + encodeURIComponent(projects ? query : ''));
        if (sequence !== searchSequence || page !== trail.at(-1)) return;
        const hasArtists = rows.length > 0;
        if (!projects) rows = rows.filter(row => projectText(row.nombre).includes(projectText(query)));
        rows = rows.filter(row => !$('typeFilter').value || row.tipo === $('typeFilter').value);
        const order = $('sort').value;
        rows.sort((a, b) => {
            const name = a.nombre.localeCompare(b.nombre, 'es');
            const date = (a.creado || '').localeCompare(b.creado || '');
            return order === 'new' ? -date || name : order === 'old' ? date || name : order === 'desc' ? -name : name;
        });
        setArtistView(compactArtists);
        $('library').innerHTML = rows.map(row => `
            <article class="card tile artist-tile">
              <button class="artist-open" onclick="openArtist('${row.id}', ${projects})">
                <span class="cover">${projectImage(row.imagen, artistInitials(row.nombre))}</span>
                <span class="tile-body"><strong>${esc(row.nombre)}</strong><span class="muted">${esc(row.tipo)}</span><small>${artistTotals(row)}</small></span>
              </button>
              <details><summary aria-label="Opciones de ${esc(row.nombre)}">•••</summary>
                <button class="alt" onclick="editArtist('${row.id}')">Editar artista</button>
                <button class="alt" onclick="openArtist('${row.id}', ${!projects})">${projects ? 'Ver ficha' : 'Ver proyectos'}</button>
              </details>
            </article>`).join('') +
            '<button class="card artist-new" onclick="editArtist()"><span>＋</span>Nuevo artista</button>';
        $('count').textContent = rows.length ? countLabel(rows.length, 'artista', 'artistas') :
            !hasArtists && !query ? 'Todavía no registraste artistas. Creá el primero para comenzar.' : 'No hay artistas que coincidan.';
    } catch (error) { report(error); }
}
async function openArtist(id, projects = false) {
    artist = await api('/api/artistas/' + id);
    if (!projects) {
        renderProfile();
        go('profile');
        return;
    }
    $('artistName').textContent = artist.nombre;
    renderArtistSocials();
    go('artistPane');
    await loadProjects(true);
}
function addMember(member = {}) {
    const block = document.createElement('fieldset');
    block.innerHTML = ['nombre','rol','telefono','correo'].map((key, i) =>
        `<label>${['Nombre','Rol o instrumento','Teléfono','Correo'][i]}<input data-key="${key}" value="${esc(member[key])}"></label>`
    ).join('') + '<button type="button" class="alt">Quitar integrante</button>';
    block.querySelector('button').onclick = () => block.remove();
    $('members').append(block);
}
async function editArtist(id, addContact = false) {
    const data = id ? await api('/api/artistas/' + id) : {};
    editing = id;
    photo = data.imagen || '';
    selectedPhoto = null;
    $('photoStatus').textContent = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $('artistForm').reset();
    $('members').replaceChildren();
    const {integrantes = [], redesSociales = [], ...profile} = data.perfil || {};
    for (const [key, value] of Object.entries({...profile, nombre: data.nombre || '', tipo: data.tipo || 'Artista'})) {
        const field = $('artistForm').elements.namedItem(key);
        if (field) field.value = value;
    }
    integrantes.forEach(addMember);
    $('legacySocial').hidden = !profile.redes;
    $('socialRows').replaceChildren();
    socialAccounts = [...redesSociales];
    renderSocials($('savedSocials'), socialAccounts, true);
    setupSocialInput();
    $('preview').hidden = !photo;
    if (photo) $('preview').src = photo;
    $('formTitle').textContent = id ? 'Editar artista' : 'Nuevo artista, grupo o banda';
    go('editor');
    if (addContact) {
        addMember();
        $('members').lastElementChild.querySelector('input').focus();
    }
}
async function saveArtist(event) {
    event.preventDefault();
    const button = $('save');
    button.disabled = true;
    try {
        const {nombre, tipo, ...perfil} = Object.fromEntries(new FormData(event.target));
        perfil.integrantes = [...$('members').children].map(block =>
            Object.fromEntries([...block.querySelectorAll('input')].map(input => [input.dataset.key,input.value.trim()]))
        ).filter(member => Object.values(member).some(Boolean));
        if ($('socialUser').value.trim() && !confirmSocial()) return;
        perfil.redesSociales = socialAccounts;
        const file = selectedPhoto;
        if (file) {
            if (file.size > 2 * 1024 * 1024 || !['image/png','image/jpeg'].includes(file.type)) {
                throw Error('Elegí una imagen JPG o PNG de hasta 2 MB.');
            }
            photo = await new Promise((resolve,reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        await api('/api/artistas' + (editing ? '/' + editing : ''), body({nombre,tipo,perfil,imagen:photo}));
        if (editing) {
            if (artist?.id === editing) {
                artist = {...artist, nombre: nombre.trim(), tipo, perfil, imagen: photo};
                $('artistName').textContent = nombre;
                renderArtistSocials();
                renderProfile();
                if (trail.at(-2) === 'artistPane') await loadProjects();
            }
            back();
        } else {
            if (['manager', 'projectManager'].includes(trail.at(-2))) back();
            else { trail.pop(); go('manager'); }
        }
    } catch (error) { report(error); }
    finally { button.disabled = false; }
}
display();

function fileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
}

// Impide que WebView abra un archivo soltado fuera de una zona.
for (const name of ['dragover', 'drop']) {
    window.addEventListener(name, event => {
        if (fileDrag(event)) event.preventDefault();
    });
}

function bindDropZone(zone, receive) {
    const input = zone.querySelector('input');
    input.addEventListener('change', () => {
        const files = Array.from(input.files);
        input.value = '';
        if (files.length) receive(files);
    });
    zone.addEventListener('dragover', event => {
        if (!fileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        zone.classList.add('is-dragging');
    });
    zone.addEventListener('dragleave', event => {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging');
    });
    zone.addEventListener('drop', event => {
        if (!fileDrag(event)) return;
        event.preventDefault();
        zone.classList.remove('is-dragging');
        const files = Array.from(event.dataTransfer.files);
        if (files.length) receive(files);
    });
}

bindDropZone($('photoZone'), files => {
    const [file] = files;
    if (files.length !== 1 || file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(file.type)) {
        $('photoStatus').textContent = 'Elegí una sola imagen JPG o PNG de hasta 2 MB.';
        return;
    }
    selectedPhoto = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    $('preview').src = previewUrl;
    $('preview').hidden = false;
    $('photoStatus').textContent = file.name;
});

function bindAttachments(songId) {
    for (const zone of document.querySelectorAll('[data-attachment]')) {
        const status = zone.querySelector('[role="status"]');
        const url = '/api/canciones/' + songId + '/adjuntos/' + zone.dataset.attachment;
        let pending = Promise.resolve();
        bindDropZone(zone, files => {
            pending = pending.then(async () => {
                status.textContent = 'Guardando archivos…';
                const saved = [];
                const failed = [];
                for (const file of files) {
                    const form = new FormData();
                    form.append('file', file);
                    try {
                        const response = await fetch(url, {method: 'POST', body: form});
                        if (!response.ok) throw Error();
                        saved.push(file.name);
                    } catch {
                        failed.push(file.name);
                    }
                }
                status.textContent = [
                    saved.length ? 'Guardados: ' + saved.join(', ') : '',
                    failed.length ? 'No se pudieron guardar: ' + failed.join(', ') : ''
                ].filter(Boolean).join(' · ');
            });
        });
    }
}

const socialNetworks = new Map([
    ['Instagram', ['https://www.instagram.com/', '@']],
    ['TikTok', ['https://www.tiktok.com/@', '@']],
    ['YouTube', ['https://www.youtube.com/@', '@']],
    ['Facebook', ['https://www.facebook.com/', '@']],
    ['X', ['https://x.com/', '@']],
    ['SoundCloud', ['https://soundcloud.com/', '@']],
    ['Bandcamp', ['https://', '', '.bandcamp.com']]
]);

function socialUrl(red, value) {
    const network = socialNetworks.get(red);
    const user = value.trim().replace(/^@/, '');
    if (!network || !/^[a-z0-9_.-]+$/i.test(user) || /^\.+$/.test(user)) return '';
    const [base, , suffix = ''] = network;
    if (suffix && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(user)) return '';
    return base + encodeURIComponent(user) + suffix;
}


const socialIcons = {
    Instagram: ['#a62d69', '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/>'],
    TikTok: ['#121212', '<path d="M14 3h3c.4 2.2 1.7 3.5 4 3.8v3a8 8 0 0 1-4-1.4v7.1a5.5 5.5 0 1 1-5.5-5.5v3a2.5 2.5 0 1 0 2.5 2.5z"/>'],
    YouTube: ['#cf1414', '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 8 6 4-6 4z" fill="#cf1414"/>'],
    Facebook: ['#1765ce', '<path d="M14 22v-9h3l.5-3H14V8c0-1 .4-2 2-2h2V3h-3c-3 0-5 2-5 5v2H7v3h3v9z"/>'],
    X: ['#101010', '<path d="M4 3h5l4 6 5-6h2l-6 7 7 11h-5l-5-7-6 7H3l7-8zm3 2 10 14h1L8 5z"/>'],
    SoundCloud: ['#b94408', '<path d="M10 16V7a5 5 0 0 1 8 3 3 3 0 1 1 1 6zM7 8h2v8H7zm-3 2h2v6H4zm-3 2h2v3H1z"/>'],
    Bandcamp: ['#216a80', '<path d="M7 6h15l-5 12H2z"/>']
};
let socialAccounts = [];

function setupSocialInput() {
    $('socialRows').innerHTML = `
        <label>Red social<select id="socialNetwork">${[...socialNetworks.keys()].map(name => `<option>${name}</option>`).join('')}</select></label>
        <label>Usuario<input id="socialUser" autocomplete="off"></label>
        <button type="button" class="alt" onclick="confirmSocial()">＋ Agregar</button>`;
    const network = $('socialNetwork');
    const user = $('socialUser');
    const updatePlaceholder = () => { user.placeholder = socialNetworks.get(network.value)[1] + 'usuario'; };
    network.addEventListener('change', updatePlaceholder);
    user.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        confirmSocial();
    });
    updatePlaceholder();
}

function confirmSocial() {
    const red = $('socialNetwork').value;
    const input = $('socialUser');
    const usuario = input.value.trim();
    const url = socialUrl(red, usuario);
    if (!url) {
        report(Error('Ingresá un usuario válido para ' + red + '.'));
        input.focus();
        return false;
    }
    if (!socialAccounts.some(account => socialUrl(account.red, account.usuario) === url)) {
        socialAccounts.push({red, usuario});
    }
    input.value = '';
    $('error').textContent = '';
    renderSocials($('savedSocials'), socialAccounts, true);
    return true;
}

function renderSocials(container, accounts, editable = false) {
    container.replaceChildren();
    accounts.forEach(({red, usuario}, index) => {
        const url = socialUrl(red, usuario);
        if (!url) return;
        const [color, icon] = socialIcons[red];
        const badge = document.createElement('span');
        badge.className = 'social-badge';
        const link = document.createElement('a');
        link.className = 'social-icon';
        link.style.setProperty('--brand', color);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = red + ' · ' + usuario;
        link.setAttribute('aria-label', 'Abrir ' + link.title);
        link.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>`;
        badge.append(link);
        if (editable) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'alt';
            remove.textContent = '×';
            remove.setAttribute('aria-label', 'Quitar ' + link.title);
            remove.onclick = () => {
                accounts.splice(index, 1);
                renderSocials(container, accounts, true);
            };
            badge.append(remove);
        }
        container.append(badge);
    });
}

function renderArtistSocials() {
    renderSocials($('artistSocials'), artist.perfil?.redesSociales || []);
}

async function openProjectFromProfile(kind) {
    await openArtist(artist.id, true);
    projectForm(kind);
}

// Solo los correos, números internacionales y URL web reconocibles se convierten en enlaces.
function contactMarkup(value, kind) {
    return String(value || '').split(/[,;\n]+/).filter(part => part.trim()).map(part => {
        const label = part.trim();
        let url;
        if (kind === 'mail' && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(label)) url = 'mailto:' + label;
        if (kind === 'phone' && /^\+[0-9 ()-]+$/.test(label)) {
            const digits = label.replace(/\D/g, '');
            if (/^[1-9][0-9]{7,14}$/.test(digits)) url = 'https://wa.me/' + digits;
        }
        if (kind === 'web' && /^https?:\/\//i.test(label)) {
            try { url = new URL(label).href; } catch { /* Mostrar el texto original. */ }
        }
        return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
    }).join('<br>');
}

function profileFields(fields) {
    return fields.map(([label, value, kind]) => `<div><dt>${label}</dt><dd>${(kind ? contactMarkup(value, kind) : esc(value)) || '—'}</dd></div>`).join('');
}

function renderProfile() {
    const profile = artist.perfil || {};
    $('profileName').textContent = artist.nombre;
    $('profileCounts').textContent = artist.tipo + ' · ' + artistTotals(artist);
    $('profileAvatar').innerHTML = projectImage(artist.imagen, artistInitials(artist.nombre));
    $('profileImage').hidden = !artist.imagen;
    if (artist.imagen) $('profileImage').src = artist.imagen;
    $('profileMain').innerHTML = profileFields([
        ['Tipo', artist.tipo], ['Formación', profile.formacion],
        ['Año de inicio', profile.anio], ['Estado', profile.estado]
    ]);
    $('profileContact').innerHTML = profileFields([
        ['Correos', profile.correos, 'mail'], ['Teléfonos / WhatsApp', profile.telefonos, 'phone'],
        ['Sitio web', profile.web, 'web'], ['Redes guardadas como texto', profile.redes], ['Notas', profile.notas]
    ]);
    $('profileMembers').innerHTML = (profile.integrantes || []).map(member => `
        <fieldset><legend>${esc(member.nombre || 'Integrante')}</legend><dl>${profileFields([
            ['Rol o instrumento', member.rol], ['Teléfono', member.telefono, 'phone'], ['Correo', member.correo, 'mail']
        ])}</dl></fieldset>`
    ).join('') || '<p class="muted">Sin integrantes registrados.</p>';
    renderSocials($('profileSocials'), profile.redesSociales || []);
}


// Beats: múltiples listas independientes, con rutas originales y orden propio.
let selectedBeatId = null;
let selectedBeatPlaylistId = localStorage.getItem('audiotaller.beats.playlist') || 'default';
let beatsPlaylists = [];
let beatsRequest = 0;
let beatPlaylistDialogMode = 'create';
async function loadBeats(loadPlaylists = true) {
    const request = ++beatsRequest;
    try {
        if (loadPlaylists) {
            const result = await api('/api/beats/playlists');
            beatsPlaylists = result.listas || [];
            const saved = localStorage.getItem('audiotaller.beats.playlist');
            if (!beatsPlaylists.some(item => item.id === selectedBeatPlaylistId)) {
                selectedBeatPlaylistId = beatsPlaylists.some(item => item.id === saved) ? saved : (beatsPlaylists[0]?.id || null);
            }
            $('beatsPlaylistSelect').innerHTML = beatsPlaylists.map(item =>
                `<option value="${esc(item.id)}">${esc(item.nombre)} (${item.cantidad})</option>`).join('');
            $('beatsPlaylistSelect').value = selectedBeatPlaylistId || '';
            $('renameBeatPlaylist').disabled = !selectedBeatPlaylistId;
            $('deleteBeatPlaylist').disabled = !selectedBeatPlaylistId;
            $('addBeats').disabled = !selectedBeatPlaylistId;
            if (selectedBeatPlaylistId) localStorage.setItem('audiotaller.beats.playlist', selectedBeatPlaylistId);
            else localStorage.removeItem('audiotaller.beats.playlist');
        }
        if (!selectedBeatPlaylistId) {
            selectedBeatId = null;
            $('beatPlayer').pause(); $('beatPlayer').removeAttribute('src'); $('beatPlayer').load();
            $('beatNow').textContent = 'Creá o seleccioná una lista para escuchar un audio.';
            $('openBeatFolder').disabled = true;
            $('beatsCount').textContent = '0 audios';
            $('beatsListTitle').textContent = 'Sin listas';
            $('beatsStatus').textContent = 'Todavía no hay listas. Usá «Nueva lista» para crear la primera.';
            $('beatsList').innerHTML = '<div class="beats-empty">No hay listas de Beats. Podés crear una nueva cuando quieras.</div>';
            return;
        }
        const result = await api('/api/beats?playlist_id=' + encodeURIComponent(selectedBeatPlaylistId));
        if (request !== beatsRequest || trail.at(-1) !== 'beats') return;
        renderBeats(result);
    } catch (error) {
        if (request === beatsRequest) $('beatsStatus').textContent = error.message;
    }
}
function renderBeats(result) {
    const beats = result.audios || [];
    const playlist = beatsPlaylists.find(item => item.id === selectedBeatPlaylistId);
    $('beatsCount').textContent = beats.length + (beats.length === 1 ? ' audio' : ' audios');
    $('beatsListTitle').textContent = playlist ? playlist.nombre : 'Mi lista de audios';
    $('beatsStatus').textContent = beats.length ? `Lista «${playlist?.nombre || 'Beats'}» guardada automáticamente.` : 'Esta lista está vacía. Usá “Agregar audios” para elegir archivos de tu PC.';
    if (selectedBeatId && !beats.some(item => item.id === selectedBeatId)) {
        selectedBeatId = null;
        $('beatPlayer').pause(); $('beatPlayer').removeAttribute('src'); $('beatPlayer').load();
        $('beatNow').textContent = 'Seleccioná un audio de la lista para escucharlo.';
        $('openBeatFolder').disabled = true;
    }
    $('beatsList').innerHTML = beats.length ? beats.map(item => `
      <div class="item beat-row" draggable="true" data-beat-row="${esc(item.id)}">
        <span class="beat-grip" title="Arrastrar para cambiar el orden" aria-hidden="true">⠿</span>
        <button class="beat-select" data-beat-select="${esc(item.id)}" aria-pressed="${item.id === selectedBeatId}">♫ <span><b>${esc(item.nombre)}</b><small class="muted" style="display:block">${esc(item.formato)} · ${item.disponible ? 'Disponible' : '<span class="beat-missing">No se encuentra en esta ubicación</span>'}</small></span></button>
        <div class="beat-actions"><button class="alt" data-beat-folder="${esc(item.id)}" title="Abrir carpeta" ${item.disponible ? '' : 'disabled'}>📁</button><button class="alt" data-beat-remove="${esc(item.id)}" title="Quitar de la lista">✕</button></div>
      </div>`).join('') : '<div class="beats-empty">Tu lista está vacía.</div>';
    for (const button of $('beatsList').querySelectorAll('[data-beat-select]')) button.addEventListener('click', () => selectBeat(button.dataset.beatSelect, beats));
    for (const button of $('beatsList').querySelectorAll('[data-beat-folder]')) button.addEventListener('click', () => openBeatFolder(button.dataset.beatFolder));
    for (const button of $('beatsList').querySelectorAll('[data-beat-remove]')) button.addEventListener('click', () => removeBeat(button.dataset.beatRemove));
    bindBeatReordering();
    if (selectedBeatId) {
        const selected = beats.find(item => item.id === selectedBeatId);
        if (selected) { $('beatNow').textContent = selected.nombre; $('openBeatFolder').disabled = !selected.disponible; }
    }
}
let draggedBeatId = null;
function bindBeatReordering() {
    const rows = $('beatsList').querySelectorAll('[data-beat-row]');
    rows.forEach(row => {
        row.addEventListener('dragstart', event => {
            draggedBeatId = row.dataset.beatRow;
            row.classList.add('beat-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedBeatId);
        });
        row.addEventListener('dragover', event => {
            if (!draggedBeatId || draggedBeatId === row.dataset.beatRow) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.classList.add('beat-drop-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('beat-drop-target'));
        row.addEventListener('drop', async event => {
            event.preventDefault(); row.classList.remove('beat-drop-target');
            const sourceId = draggedBeatId || event.dataTransfer.getData('text/plain'); draggedBeatId = null;
            if (sourceId && sourceId !== row.dataset.beatRow) await moveBeatBefore(sourceId, row.dataset.beatRow);
        });
        row.addEventListener('dragend', () => { draggedBeatId = null; rows.forEach(item => item.classList.remove('beat-dragging', 'beat-drop-target')); });
    });
}
async function persistBeatOrder(ids) {
    try {
        await api('/api/beats/orden', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids,playlist_id:selectedBeatPlaylistId})});
        await loadBeats(false);
    } catch (error) { report(error); await loadBeats(false); }
}
async function moveBeatBefore(sourceId, targetId) {
    try {
        const result = await api('/api/beats?playlist_id=' + encodeURIComponent(selectedBeatPlaylistId));
        const ids = (result.audios || []).map(item => item.id);
        const from = ids.indexOf(sourceId), to = ids.indexOf(targetId);
        if (from < 0 || to < 0 || from === to) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]); await persistBeatOrder(ids);
    } catch (error) { report(error); }
}
async function addBeats() {
    try {
        if (!selectedBeatPlaylistId) throw Error('Primero creá o seleccioná una lista de Beats.');
        if (!window.pywebview?.api?.choose_audio_files) throw Error('El selector de archivos local está disponible al iniciar AudioTaller desde Iniciar_AudioTaller.vbs.');
        const paths = await window.pywebview.api.choose_audio_files();
        if (!paths || !paths.length) return;
        const result = await api('/api/beats', body({paths,playlist_id:selectedBeatPlaylistId}));
        $('beatsStatus').textContent = result.agregados + ' audio(s) agregado(s).' + (result.omitidos ? ' ' + result.omitidos + ' omitido(s).' : '');
        await loadBeats(true);
    } catch (error) { report(error); }
}
function selectBeat(id, beats) {
    const beat = beats.find(item => item.id === id);
    if (!beat || !beat.disponible) { report(Error('No se encuentra el archivo en su ubicación original.')); return; }
    selectedBeatId = id; $('beatNow').textContent = beat.nombre;
    $('beatPlayer').src = '/api/beats/' + encodeURIComponent(id) + '/audio'; $('beatPlayer').load();
    $('openBeatFolder').disabled = false; renderBeats({audios: beats});
}
async function openBeatFolder(id = selectedBeatId) {
    if (!id) return;
    try {
        if (!window.pywebview?.api?.open_location) throw Error('La apertura de carpetas requiere la aplicación de escritorio.');
        const result = await window.pywebview.api.open_location(id);
        if (!result) throw Error('No se pudo abrir la carpeta del audio.');
    } catch (error) { report(error); }
}
async function removeBeat(id) {
    if (!confirm('¿Quitar este audio de la lista? El archivo original no se borrará.')) return;
    try { await api('/api/beats/' + encodeURIComponent(id), {method:'DELETE'}); await loadBeats(true); }
    catch (error) { report(error); }
}
async function deleteBeatPlaylist() {
    const playlist = beatsPlaylists.find(item => item.id === selectedBeatPlaylistId);
    if (!playlist) return;
    const count = Number(playlist.cantidad) || 0;
    const detail = count === 1 ? '1 audio' : `${count} audios`;
    if (!confirm(`¿Eliminar la lista «${playlist.nombre}»? Contiene ${detail}. Se quitarán de AudioTaller, pero los archivos originales permanecerán en tu PC.`)) return;
    try {
        await api('/api/beats/playlists/' + encodeURIComponent(playlist.id), {method:'DELETE'});
        selectedBeatId = null;
        $('beatPlayer').pause(); $('beatPlayer').removeAttribute('src'); $('beatPlayer').load();
        $('beatNow').textContent = 'Seleccioná un audio de la lista para escucharlo.';
        $('openBeatFolder').disabled = true;
        selectedBeatPlaylistId = null;
        localStorage.removeItem('audiotaller.beats.playlist');
        await loadBeats(true);
    } catch (error) { report(error); }
}
function openBeatPlaylistDialog(mode) {
    beatPlaylistDialogMode = mode;
    const current = beatsPlaylists.find(item => item.id === selectedBeatPlaylistId);
    $('beatPlaylistDialogTitle').textContent = mode === 'create' ? 'Crear nueva lista' : 'Cambiar nombre de la lista';
    $('beatPlaylistName').value = mode === 'rename' ? (current?.nombre || '') : '';
    $('beatPlaylistDialog').showModal(); $('beatPlaylistName').focus();
}
$('beatPlaylistForm').addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('beatPlaylistName').value.trim();
    if (!name) return;
    const submit = $('beatPlaylistForm').querySelector('[type=submit]'); submit.disabled = true;
    try {
        if (beatPlaylistDialogMode === 'create') {
            const created = await api('/api/beats/playlists', body({nombre:name}));
            selectedBeatPlaylistId = created.id; localStorage.setItem('audiotaller.beats.playlist', created.id);
        } else {
            await api('/api/beats/playlists/' + encodeURIComponent(selectedBeatPlaylistId), {method:'PATCH',body:JSON.stringify({nombre:name})});
        }
        $('beatPlaylistDialog').close(); await loadBeats(true);
    } catch (error) { report(error); }
    finally { submit.disabled = false; }
});
$('cancelBeatPlaylist').addEventListener('click', () => $('beatPlaylistDialog').close());
$('newBeatPlaylist').addEventListener('click', () => openBeatPlaylistDialog('create'));
$('renameBeatPlaylist').addEventListener('click', () => openBeatPlaylistDialog('rename'));
$('deleteBeatPlaylist').addEventListener('click', deleteBeatPlaylist);
$('beatsPlaylistSelect').addEventListener('change', async event => {
    selectedBeatPlaylistId = event.target.value || null;
    if (selectedBeatPlaylistId) localStorage.setItem('audiotaller.beats.playlist', selectedBeatPlaylistId);
    else localStorage.removeItem('audiotaller.beats.playlist');
    selectedBeatId = null; $('beatPlayer').pause(); $('beatPlayer').removeAttribute('src'); $('beatPlayer').load();
    $('beatNow').textContent = 'Seleccioná un audio de la lista para escucharlo.'; $('openBeatFolder').disabled = true;
    await loadBeats(false);
});
$('addBeats').addEventListener('click', addBeats);
$('openBeatFolder').addEventListener('click', () => openBeatFolder());


// Partituras: colecciones independientes, archivos originales y visor integrado.
let selectedScoreCollectionId = localStorage.getItem('audiotaller.scores.collection') || null;
let selectedScoreId = null;
let scoreCollections = [];
let scoreDialogMode = 'create';
let draggedScoreId = null;
let scoresRequest = 0;

async function loadScores(loadCollections = true) {
    const requestId = ++scoresRequest;
    try {
        if (loadCollections) {
            const data = await api('/api/scores/collections');
            scoreCollections = data.colecciones || [];
            if (!scoreCollections.some(x => x.id === selectedScoreCollectionId)) {
                const saved = localStorage.getItem('audiotaller.scores.collection');
                selectedScoreCollectionId = scoreCollections.some(x => x.id === saved) ? saved : (scoreCollections[0]?.id || null);
            }
            $('scoresCollectionSelect').innerHTML = scoreCollections.map(x => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('');
            $('scoresCollectionSelect').value = selectedScoreCollectionId || '';
            $('scoresCollectionSelect').disabled = !scoreCollections.length;
            $('renameScoreCollection').disabled = !selectedScoreCollectionId;
            $('deleteScoreCollection').disabled = !selectedScoreCollectionId;
            $('addScores').disabled = !selectedScoreCollectionId;
            if (selectedScoreCollectionId) localStorage.setItem('audiotaller.scores.collection', selectedScoreCollectionId);
            else localStorage.removeItem('audiotaller.scores.collection');
        }
        if (!selectedScoreCollectionId) {
            $('scoresCount').textContent = '0 partituras'; $('scoresListTitle').textContent = 'Sin colecciones';
            $('scoresStatus').textContent = 'Todavía no hay colecciones. Creá una para comenzar.';
            $('scoresList').innerHTML = '<div class="muted">No hay colecciones de partituras.</div>';
            clearScoreViewer(); return;
        }
        const data = await api('/api/scores?collection_id=' + encodeURIComponent(selectedScoreCollectionId));
        if (requestId !== scoresRequest || trail.at(-1) !== 'scores') return;
        renderScores(data);
    } catch (error) { if (requestId === scoresRequest) $('scoresStatus').textContent = error.message; }
}
function clearScoreViewer() {
    selectedScoreId = null; $('scoreNow').textContent = 'Seleccioná una partitura de la colección para verla.';
    $('openScoreFolder').disabled = true;
    $('scoreViewer').innerHTML = '<div class="score-viewer-empty">♫<br>La vista previa aparecerá acá.</div>';
}
function renderScores(data) {
    const items = data.partituras || [];
    const collection = scoreCollections.find(x => x.id === selectedScoreCollectionId);
    $('scoresCount').textContent = items.length + (items.length === 1 ? ' partitura' : ' partituras');
    $('scoresListTitle').textContent = collection?.nombre || 'Mis partituras';
    $('scoresStatus').textContent = items.length ? `Colección «${collection?.nombre || 'Partituras'}» guardada automáticamente.` : 'Esta colección está vacía. Usá «Agregar partituras» para elegir archivos de tu PC.';
    if (selectedScoreId && !items.some(x => x.id === selectedScoreId)) clearScoreViewer();
    $('scoresList').innerHTML = items.length ? items.map(item => `
      <div class="item score-row" draggable="true" data-score-row="${esc(item.id)}">
        <span class="score-grip" title="Arrastrar para cambiar el orden">⠿</span>
        <button class="score-select" data-score-select="${esc(item.id)}" aria-pressed="${item.id === selectedScoreId}"><span>▤ <b>${esc(item.nombre)}</b><small class="muted">${esc(item.formato)} · ${item.disponible ? 'Disponible' : '<span class="score-missing">No se encuentra en esta ubicación</span>'}</small></span></button>
        <div class="score-actions"><button class="alt" data-score-folder="${esc(item.id)}" title="Abrir carpeta" ${item.disponible ? '' : 'disabled'}>📁</button><button class="alt" data-score-remove="${esc(item.id)}" title="Quitar de la colección">✕</button></div>
      </div>`).join('') : '<div class="muted">Tu colección está vacía.</div>';
    for (const b of $('scoresList').querySelectorAll('[data-score-select]')) b.addEventListener('click', () => selectScore(b.dataset.scoreSelect, items));
    for (const b of $('scoresList').querySelectorAll('[data-score-folder]')) b.addEventListener('click', () => openScoreFolder(b.dataset.scoreFolder));
    for (const b of $('scoresList').querySelectorAll('[data-score-remove]')) b.addEventListener('click', () => removeScore(b.dataset.scoreRemove));
    bindScoreReordering();
    if (selectedScoreId) { const selected = items.find(x => x.id === selectedScoreId); if (selected) $('scoreNow').textContent = selected.nombre; }
}
function selectScore(id, items) {
    const item = items.find(x => x.id === id);
    if (!item || !item.disponible) { report(Error('No se encuentra el archivo en su ubicación original.')); return; }
    selectedScoreId = id; $('scoreNow').textContent = item.nombre; $('openScoreFolder').disabled = false;
    const url = '/api/scores/' + encodeURIComponent(id) + '/file';
    if (item.formato === 'PDF') $('scoreViewer').innerHTML = `<iframe title="Vista previa de ${esc(item.nombre)}" src="${url}"></iframe>`;
    else $('scoreViewer').innerHTML = `<img alt="Vista previa de ${esc(item.nombre)}" src="${url}">`;
    renderScores({partituras:items});
}
async function addScores() {
    try {
        if (!selectedScoreCollectionId) throw Error('Primero creá o seleccioná una colección.');
        if (!window.pywebview?.api?.choose_score_files) throw Error('El selector local está disponible al iniciar AudioTaller desde Iniciar_AudioTaller.vbs.');
        const paths = await window.pywebview.api.choose_score_files(); if (!paths?.length) return;
        const result = await api('/api/scores', body({paths,collection_id:selectedScoreCollectionId}));
        $('scoresStatus').textContent = result.agregados + ' partitura(s) agregada(s).' + (result.omitidos ? ' ' + result.omitidos + ' omitida(s).' : '');
        await loadScores(true);
    } catch (error) { report(error); }
}
async function openScoreFolder(id=selectedScoreId) {
    if (!id) return;
    try {
        if (!window.pywebview?.api?.open_score_location) throw Error('La apertura de carpetas requiere la aplicación de escritorio.');
        if (!await window.pywebview.api.open_score_location(id)) throw Error('No se pudo abrir la carpeta de la partitura.');
    } catch (error) { report(error); }
}
async function removeScore(id) {
    if (!confirm('¿Quitar esta partitura de la colección? El archivo original no se borrará.')) return;
    try { await api('/api/scores/' + encodeURIComponent(id), {method:'DELETE'}); await loadScores(true); }
    catch (error) { report(error); }
}
async function deleteScoreCollection() {
    const collection = scoreCollections.find(x => x.id === selectedScoreCollectionId); if (!collection) return;
    const count = Number(collection.cantidad) || 0;
    if (!confirm(`¿Eliminar la colección «${collection.nombre}»? Se quitarán ${count} referencia(s) de AudioTaller, pero los archivos originales permanecerán en tu PC.`)) return;
    try {
        await api('/api/scores/collections/' + encodeURIComponent(collection.id), {method:'DELETE'});
        selectedScoreCollectionId = null; localStorage.removeItem('audiotaller.scores.collection'); clearScoreViewer(); await loadScores(true);
    } catch (error) { report(error); }
}
function openScoreCollectionDialog(mode) {
    scoreDialogMode = mode; const current = scoreCollections.find(x => x.id === selectedScoreCollectionId);
    $('scoreCollectionDialogTitle').textContent = mode === 'create' ? 'Crear nueva colección' : 'Cambiar nombre de la colección';
    $('scoreCollectionName').value = mode === 'rename' ? (current?.nombre || '') : '';
    $('scoreCollectionDialog').showModal(); $('scoreCollectionName').focus();
}
$('scoreCollectionForm').addEventListener('submit', async event => {
    event.preventDefault(); const name = $('scoreCollectionName').value.trim(); if (!name) return;
    const submit = $('scoreCollectionForm').querySelector('[type=submit]'); submit.disabled = true;
    try {
        if (scoreDialogMode === 'create') {
            const created = await api('/api/scores/collections', body({nombre:name}));
            selectedScoreCollectionId = created.id; localStorage.setItem('audiotaller.scores.collection',created.id);
        } else await api('/api/scores/collections/' + encodeURIComponent(selectedScoreCollectionId), {method:'PATCH',body:JSON.stringify({nombre:name})});
        $('scoreCollectionDialog').close(); await loadScores(true);
    } catch (error) { report(error); } finally { submit.disabled = false; }
});
function bindScoreReordering() {
    const rows = $('scoresList').querySelectorAll('[data-score-row]');
    rows.forEach(row => {
        row.addEventListener('dragstart', event => { draggedScoreId=row.dataset.scoreRow; row.classList.add('beat-dragging'); event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/plain',draggedScoreId); });
        row.addEventListener('dragover', event => { if (!draggedScoreId || draggedScoreId===row.dataset.scoreRow) return; event.preventDefault(); event.dataTransfer.dropEffect='move'; row.classList.add('beat-drop-target'); });
        row.addEventListener('dragleave', () => row.classList.remove('beat-drop-target'));
        row.addEventListener('drop', async event => { event.preventDefault(); row.classList.remove('beat-drop-target'); const source=draggedScoreId || event.dataTransfer.getData('text/plain'); draggedScoreId=null; if(source && source!==row.dataset.scoreRow) await moveScoreBefore(source,row.dataset.scoreRow); });
        row.addEventListener('dragend', () => { draggedScoreId=null; rows.forEach(x=>x.classList.remove('beat-dragging','beat-drop-target')); });
    });
}
async function moveScoreBefore(sourceId,targetId) {
    try {
        const data=await api('/api/scores?collection_id='+encodeURIComponent(selectedScoreCollectionId));
        const ids=(data.partituras||[]).map(x=>x.id); const from=ids.indexOf(sourceId),to=ids.indexOf(targetId);
        if(from<0||to<0||from===to)return; ids.splice(to,0,ids.splice(from,1)[0]);
        await api('/api/scores/orden',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,collection_id:selectedScoreCollectionId})});
        await loadScores(false);
    } catch(error) { report(error); await loadScores(false); }
}
$('scoresCollectionSelect').addEventListener('change', async event => {
    selectedScoreCollectionId=event.target.value||null;
    if(selectedScoreCollectionId)localStorage.setItem('audiotaller.scores.collection',selectedScoreCollectionId);else localStorage.removeItem('audiotaller.scores.collection');
    clearScoreViewer(); await loadScores(false);
});
$('addScores').addEventListener('click',addScores);
$('newScoreCollection').addEventListener('click',()=>openScoreCollectionDialog('create'));
$('renameScoreCollection').addEventListener('click',()=>openScoreCollectionDialog('rename'));
$('deleteScoreCollection').addEventListener('click',deleteScoreCollection);
$('openScoreFolder').addEventListener('click',()=>openScoreFolder());
$('cancelScoreCollection').addEventListener('click',()=>$('scoreCollectionDialog').close());
// Letras: organización de archivos TXT y DOCX en colecciones.
let lyricCollections=[], selectedLyricCollectionId=localStorage.getItem('audiotaller.lyrics.collection')||null;
let selectedLyricId=null, lyricDialogMode='create', draggedLyricId=null, lyricsRequest=0;
async function loadLyrics(preserve=false) {
    const req=++lyricsRequest;
    try {
        const data=await api('/api/lyrics/collections'); lyricCollections=data.colecciones||[];
        if(!preserve||!lyricCollections.some(x=>x.id===selectedLyricCollectionId)) {
            const saved=localStorage.getItem('audiotaller.lyrics.collection');
            selectedLyricCollectionId=lyricCollections.some(x=>x.id===saved)?saved:(lyricCollections[0]?.id||null);
        }
        $('lyricsCollectionSelect').innerHTML=lyricCollections.map(x=>`<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('');
        $('lyricsCollectionSelect').value=selectedLyricCollectionId||'';
        $('lyricsCollectionSelect').disabled=!lyricCollections.length;
        $('renameLyricCollection').disabled=!selectedLyricCollectionId;
        $('deleteLyricCollection').disabled=!selectedLyricCollectionId;
        $('addLyrics').disabled=!selectedLyricCollectionId;
        if(selectedLyricCollectionId)localStorage.setItem('audiotaller.lyrics.collection',selectedLyricCollectionId);else localStorage.removeItem('audiotaller.lyrics.collection');
        if(!selectedLyricCollectionId) {
            $('lyricsCount').textContent='0 letras'; $('lyricsListTitle').textContent='Sin colecciones';
            $('lyricsStatus').textContent='Todavía no hay colecciones. Creá una para comenzar.';
            $('lyricsList').innerHTML='<div class="muted">No hay colecciones de letras.</div>'; clearLyricViewer(); return;
        }
        const result=await api('/api/lyrics?collection_id='+encodeURIComponent(selectedLyricCollectionId));
        if(req!==lyricsRequest||trail.at(-1)!=='lyrics')return; renderLyrics(result);
    } catch(error) { if(req===lyricsRequest)$('lyricsStatus').textContent=error.message; }
}
function clearLyricViewer(){selectedLyricId=null;$('lyricNow').textContent='Seleccioná una letra de la colección para verla.';$('openLyricFolder').disabled=true;$('lyricViewer').textContent='♫\nEl contenido de la letra aparecerá acá.';}
function renderLyrics(data){
    const items=data.letras||[], collection=lyricCollections.find(x=>x.id===selectedLyricCollectionId);
    $('lyricsCount').textContent=items.length+(items.length===1?' letra':' letras'); $('lyricsListTitle').textContent=collection?.nombre||'Mis letras';
    $('lyricsStatus').textContent=items.length?`Colección «${collection?.nombre||'Letras'}» guardada automáticamente.`:'Esta colección está vacía. Usá «Agregar letras» para elegir archivos de tu PC.';
    if(selectedLyricId&&!items.some(x=>x.id===selectedLyricId))clearLyricViewer();
    $('lyricsList').innerHTML=items.length?items.map(item=>`<div class="item lyric-row" draggable="true" data-lyric-row="${esc(item.id)}"><span class="lyric-grip" title="Arrastrar para cambiar el orden">⠿</span><button class="lyric-select" data-lyric-select="${esc(item.id)}" aria-pressed="${item.id===selectedLyricId}"><span>▤ <b>${esc(item.nombre)}</b><small class="muted">${esc(item.formato)} · ${item.disponible?'Disponible':'No se encuentra en esta ubicación'}</small></span></button><div class="lyric-actions"><button class="alt" data-lyric-folder="${esc(item.id)}" title="Abrir carpeta" ${item.disponible?'':'disabled'}>📁</button><button class="alt" data-lyric-remove="${esc(item.id)}" title="Quitar de la colección">✕</button></div></div>`).join(''):'<div class="muted">Tu colección está vacía.</div>';
    for(const b of $('lyricsList').querySelectorAll('[data-lyric-select]'))b.addEventListener('click',()=>selectLyric(b.dataset.lyricSelect,items));
    for(const b of $('lyricsList').querySelectorAll('[data-lyric-folder]'))b.addEventListener('click',()=>openLyricFolder(b.dataset.lyricFolder));
    for(const b of $('lyricsList').querySelectorAll('[data-lyric-remove]'))b.addEventListener('click',()=>removeLyric(b.dataset.lyricRemove));
    bindLyricReordering();
}
async function selectLyric(id,items){
    const item=items.find(x=>x.id===id); if(!item||!item.disponible){report(Error('No se encuentra el archivo en su ubicación original.'));return;}
    selectedLyricId=id;$('lyricNow').textContent=item.nombre;$('openLyricFolder').disabled=false;$('lyricViewer').textContent='Cargando letra…';renderLyrics({letras:items});
    try{const response=await fetch('/api/lyrics/'+encodeURIComponent(id)+'/file');if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'No se pudo abrir la letra.');}$('lyricViewer').textContent=await response.text();}
    catch(error){$('lyricViewer').textContent=error.message;report(error);}
}
async function addLyrics(){
    try{if(!selectedLyricCollectionId)throw Error('Primero creá o seleccioná una colección.');if(!window.pywebview?.api?.choose_lyric_files)throw Error('El selector local está disponible al iniciar AudioTaller desde Iniciar_AudioTaller.vbs.');const paths=await window.pywebview.api.choose_lyric_files();if(!paths?.length)return;const result=await api('/api/lyrics',body({paths,collection_id:selectedLyricCollectionId}));$('lyricsStatus').textContent=result.agregados+' letra(s) agregada(s).'+(result.omitidos?' '+result.omitidos+' omitida(s).':'');await loadLyrics(true);}
    catch(error){report(error);}
}
async function openLyricFolder(id=selectedLyricId){if(!id)return;try{if(!window.pywebview?.api?.open_lyric_location)throw Error('La apertura de carpetas requiere la aplicación de escritorio.');if(!await window.pywebview.api.open_lyric_location(id))throw Error('No se pudo abrir la carpeta de la letra.');}catch(error){report(error);}}
async function removeLyric(id){if(!confirm('¿Quitar esta letra de la colección? El archivo original no se borrará.'))return;try{await api('/api/lyrics/'+encodeURIComponent(id),{method:'DELETE'});await loadLyrics(true);}catch(error){report(error);}}
async function deleteLyricCollection(){const collection=lyricCollections.find(x=>x.id===selectedLyricCollectionId);if(!collection)return;const count=Number(collection.cantidad)||0;if(!confirm(`¿Eliminar la colección «${collection.nombre}»? Se quitarán ${count} referencia(s) de AudioTaller, pero los archivos originales permanecerán en tu PC.`))return;try{await api('/api/lyrics/collections/'+encodeURIComponent(collection.id),{method:'DELETE'});selectedLyricCollectionId=null;localStorage.removeItem('audiotaller.lyrics.collection');clearLyricViewer();await loadLyrics(true);}catch(error){report(error);}}
function openLyricCollectionDialog(mode){lyricDialogMode=mode;const current=lyricCollections.find(x=>x.id===selectedLyricCollectionId);$('lyricCollectionDialogTitle').textContent=mode==='create'?'Crear nueva colección':'Cambiar nombre de la colección';$('lyricCollectionName').value=mode==='rename'?(current?.nombre||''):'';$('lyricCollectionDialog').showModal();$('lyricCollectionName').focus();}
$('lyricCollectionForm').addEventListener('submit',async event=>{event.preventDefault();const name=$('lyricCollectionName').value.trim();if(!name)return;const submit=$('lyricCollectionForm').querySelector('[type=submit]');submit.disabled=true;try{if(lyricDialogMode==='create'){const created=await api('/api/lyrics/collections',body({nombre:name}));selectedLyricCollectionId=created.id;localStorage.setItem('audiotaller.lyrics.collection',created.id);}else await api('/api/lyrics/collections/'+encodeURIComponent(selectedLyricCollectionId),{method:'PATCH',body:JSON.stringify({nombre:name})});$('lyricCollectionDialog').close();await loadLyrics(true);}catch(error){report(error);}finally{submit.disabled=false;}});
function bindLyricReordering(){const rows=$('lyricsList').querySelectorAll('[data-lyric-row]');rows.forEach(row=>{row.addEventListener('dragstart',event=>{draggedLyricId=row.dataset.lyricRow;row.classList.add('beat-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedLyricId);});row.addEventListener('dragover',event=>{if(!draggedLyricId||draggedLyricId===row.dataset.lyricRow)return;event.preventDefault();event.dataTransfer.dropEffect='move';row.classList.add('beat-drop-target');});row.addEventListener('dragleave',()=>row.classList.remove('beat-drop-target'));row.addEventListener('drop',async event=>{event.preventDefault();row.classList.remove('beat-drop-target');const source=draggedLyricId||event.dataTransfer.getData('text/plain');draggedLyricId=null;if(source&&source!==row.dataset.lyricRow)await moveLyricBefore(source,row.dataset.lyricRow);});row.addEventListener('dragend',()=>{draggedLyricId=null;rows.forEach(x=>x.classList.remove('beat-dragging','beat-drop-target'));});});}
async function moveLyricBefore(sourceId,targetId){try{const data=await api('/api/lyrics?collection_id='+encodeURIComponent(selectedLyricCollectionId));const ids=(data.letras||[]).map(x=>x.id),from=ids.indexOf(sourceId),to=ids.indexOf(targetId);if(from<0||to<0||from===to)return;ids.splice(to,0,ids.splice(from,1)[0]);await api('/api/lyrics/orden',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,collection_id:selectedLyricCollectionId})});await loadLyrics(false);}catch(error){report(error);await loadLyrics(false);}}
$('lyricsCollectionSelect').addEventListener('change',async event=>{selectedLyricCollectionId=event.target.value||null;if(selectedLyricCollectionId)localStorage.setItem('audiotaller.lyrics.collection',selectedLyricCollectionId);else localStorage.removeItem('audiotaller.lyrics.collection');clearLyricViewer();await loadLyrics(false);});
$('addLyrics').addEventListener('click',addLyrics);$('newLyricCollection').addEventListener('click',()=>openLyricCollectionDialog('create'));$('renameLyricCollection').addEventListener('click',()=>openLyricCollectionDialog('rename'));$('deleteLyricCollection').addEventListener('click',deleteLyricCollection);$('openLyricFolder').addEventListener('click',()=>openLyricFolder());$('cancelLyricCollection').addEventListener('click',()=>$('lyricCollectionDialog').close());

