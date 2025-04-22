document.addEventListener('DOMContentLoaded', init);

// --- Globalne Varijable i Konstante ---
let rasporedData = [];
let trenutniDatum = new Date();
let updateIntervalId = null;
const LS_THEME_KEY = 'rasporedAppTheme';

const ispitniRokovi = [
    { pocetak: new Date(2025, 3, 22, 0, 0, 0, 0), kraj: new Date(2025, 3, 29, 23, 59, 59, 999) },
    { pocetak: new Date(2025, 5, 16, 0, 0, 0, 0), kraj: new Date(2025, 5, 28, 23, 59, 59, 999) }
];

// --- DOM Elementi ---
const rasporedDiv = document.getElementById('raspored');
const prikazaniDatumH2 = document.getElementById('prikazaniDatum');
const prevDayBtn = document.getElementById('prevDay');
const nextDayBtn = document.getElementById('nextDay');
const vrijemeInfoP = document.getElementById('trenutnoVrijemeInfo');
const todayBtn = document.getElementById('todayBtn');
const themeToggle = document.getElementById('checkboxTheme');
const metaThemeColor = document.getElementById('metaThemeColor');

// --- Inicijalizacija ---
async function init() {
    setupTheme();
    prevDayBtn.addEventListener('click', () => promijeniDan(-1));
    nextDayBtn.addEventListener('click', () => promijeniDan(1));
    todayBtn.addEventListener('click', () => {
        if (trenutniDatum.toDateString() !== new Date().toDateString()) {
            prikaziRaspored(new Date());
        }
    });
    themeToggle.addEventListener('change', handleThemeToggle);

    try {
        const response = await fetch('raspored2.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        rasporedData = data.data.map(item => ({
            ...item,
            vrijemePocetkaObj: parseVrijeme(item.terminPocetak),
            vrijemeKrajaObj: parseVrijeme(item.terminKraj)
        })).filter(item => item.vrijemePocetkaObj && item.vrijemeKrajaObj);

        rasporedData.sort((a, b) => {
            const datumA = parseJSONDatum(a.datum);
            const datumB = parseJSONDatum(b.datum);
            if (isNaN(datumA.getTime())) return 1;
            if (isNaN(datumB.getTime())) return -1;
            if (datumA.getTime() !== datumB.getTime()) return datumA.getTime() - datumB.getTime();
            if (a.vrijemePocetkaObj && b.vrijemePocetkaObj) {
                return a.vrijemePocetkaObj.getTime() - b.vrijemePocetkaObj.getTime();
            }
            return 0;
        });

        prikaziRaspored(trenutniDatum);
        clearInterval(updateIntervalId);
        updateIntervalId = setInterval(azurirajPrikaz, 1000);
        azurirajPrikaz();
        registerServiceWorker();

    } catch (error) {
        console.error("Greška pri učitavanju ili obradi rasporeda:", error);
        rasporedDiv.innerHTML = "<p>Došlo je do greške pri učitavanju rasporeda.</p>";
        prikazaniDatumH2.innerText = "Greška";
    }
}

// --- Funkcije za Temu ---
function setupTheme() {
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
         document.body.classList.remove('dark-mode');
         themeToggle.checked = false;
    }
    updateMetaThemeColor();
}
function handleThemeToggle() {
    if (themeToggle.checked) { enableDarkMode(); }
    else { disableDarkMode(); }
}
function enableDarkMode(save = true) {
    document.body.classList.add('dark-mode');
    if (save) localStorage.setItem(LS_THEME_KEY, 'dark');
    updateMetaThemeColor();
}
function disableDarkMode(save = true) {
    document.body.classList.remove('dark-mode');
    if (save) localStorage.setItem(LS_THEME_KEY, 'light');
    updateMetaThemeColor();
}
function updateMetaThemeColor() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    // Dohvati stvarnu boju iz CSS varijable - ispravljeno da dohvati točnu varijablu
    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--header-bg').trim();
    // theme-color treba biti --header-bg u oba moda
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', headerBgColor);
    }
}


// --- Registracija SW ---
function registerServiceWorker() {
     if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js') // Provjeri je li putanja točna!
                .then(registration => console.log('SW registriran:', registration.scope))
                .catch(error => console.error('SW registracija neuspjela:', error));
        });
    } else { console.log('SW nije podržan.'); }
}

// --- Prikaz Rasporeda ---
function prikaziRaspored(datum) {
    trenutniDatum = new Date(datum);
    rasporedDiv.innerHTML = ''; // Počni s čistim divom
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    prikazaniDatumH2.innerText = datum.toLocaleDateString("hr-HR", options);
    prikazaniDatumH2.classList.toggle('danasnji-datum', datum.toDateString() === new Date().toDateString());

    const datumZaUsporedbu = new Date(datum);
    datumZaUsporedbu.setHours(0, 0, 0, 0);
    let jeIspitniRok = false;
    let trenutniRokInfo = null;
    for (const rok of ispitniRokovi) {
        if (datumZaUsporedbu >= rok.pocetak && datumZaUsporedbu <= rok.kraj) {
            jeIspitniRok = true;
            trenutniRokInfo = rok;
            break;
        }
    }

    if (jeIspitniRok && trenutniRokInfo) {
        rasporedDiv.innerHTML = `<div class="ispitni-rok-info"><h3><i class="fas fa-calendar-alt fa-fw"></i> Ispitni Rok</h3><p>U tijeku su ispitni rokovi.</p><p>(Od ${trenutniRokInfo.pocetak.toLocaleDateString('hr-HR')} do ${trenutniRokInfo.kraj.toLocaleDateString('hr-HR')})</p></div>`;
        azurirajSamoVrijeme();
        return;
    }

    const rasporedZaDatum = rasporedData.filter(p => {
        const predDatum = parseJSONDatum(p.datum);
        return !isNaN(predDatum.getTime()) && predDatum.toDateString() === datum.toDateString();
    }).sort((a,b) => a.vrijemePocetkaObj.getTime() - b.vrijemePocetkaObj.getTime());

    if (rasporedZaDatum.length === 0) {
        rasporedDiv.innerHTML = '<p>Nema predavanja za ovaj dan.</p>';
        azurirajSamoVrijeme();
        return;
    }

    const sada = new Date();
    let nextUpIndex = -1;
    if (datum.toDateString() === sada.toDateString()) {
        for (let i = 0; i < rasporedZaDatum.length; i++) {
             const termin = rasporedZaDatum[i];
             const vrijemeKrajaTermina = new Date(trenutniDatum);
             vrijemeKrajaTermina.setHours(termin.vrijemeKrajaObj.getHours(), termin.vrijemeKrajaObj.getMinutes(), 0, 0);
             if (vrijemeKrajaTermina > sada) { nextUpIndex = i; break; }
        }
    }

    // Koristi DocumentFragment za bolju performansu kod dodavanja više elemenata
    const fragment = document.createDocumentFragment();

    rasporedZaDatum.forEach((predavanje, index) => {
        const terminDiv = document.createElement('div');
        terminDiv.className = `termin ${predavanje.tip === 'Vježbe' ? 'vjezbe' : 'predavanje'}`;
        if (nextUpIndex !== -1 && index === nextUpIndex) terminDiv.classList.add('next-up');
        const originalIndex = rasporedData.findIndex(p => p === predavanje);
        terminDiv.dataset.id = `termin-${originalIndex}`; // Koristi data-id za pouzdano pronalaženje
        terminDiv.innerHTML = `<h3>${predavanje.predmet}</h3><p><i class="fa-regular fa-clock fa-fw"></i> ${predavanje.terminPocetak || 'N/A'} - ${predavanje.terminKraj || 'N/A'}</p><p><i class="${predavanje.tip === 'Vježbe' ? 'fas fa-tools' : 'fas fa-book-open'} fa-fw"></i> Tip: ${predavanje.tip || 'N/A'}</p><p><i class="fa-solid fa-location-dot fa-fw"></i> ${predavanje.dvorana || 'N/A'}</p><p><i class="fa-solid fa-user-tie fa-fw"></i> ${predavanje.nastavnik || 'N/A'}</p><div class="termin-status-container"><p class="status-text"><i class="fa-solid fa-circle-info fa-fw"></i> <span>Učitavanje...</span></p><p class="timer-text" style="display: none;"><i class="fa-solid fa-hourglass-half fa-fw"></i> <span></span></p></div><div class="progress-bar-container"><div class="progress-bar-fill"></div></div>`;
        fragment.appendChild(terminDiv);

        const sljedeciTermin = rasporedZaDatum[index + 1];
        if (sljedeciTermin) {
            const krajTrenutnog = new Date(trenutniDatum);
            krajTrenutnog.setHours(predavanje.vrijemeKrajaObj.getHours(), predavanje.vrijemeKrajaObj.getMinutes(), 0, 0);
            const pocetakSljedeceg = new Date(trenutniDatum);
            pocetakSljedeceg.setHours(sljedeciTermin.vrijemePocetkaObj.getHours(), sljedeciTermin.vrijemePocetkaObj.getMinutes(), 0, 0);
            const razlikaMs = pocetakSljedeceg.getTime() - krajTrenutnog.getTime();
            if (razlikaMs > 60000) { // Prikazi pauzu ako je duza od minute
                const pauzaDiv = document.createElement('div');
                pauzaDiv.className = 'pauza-info';
                pauzaDiv.innerHTML = `<i class="fas fa-mug-hot"></i> Pauza: ${formatirajVremenskuRazliku(razlikaMs)}`;
                fragment.appendChild(pauzaDiv);
            }
        }
    });
    // Dodaj sve elemente odjednom u DOM
    rasporedDiv.appendChild(fragment);
    azurirajPrikaz(); // Ažuriraj status nakon dodavanja
}

// --- Ažuriranje Prikaza ---
function azurirajPrikaz() {
    const sada = new Date();
    azurirajSamoVrijeme(sada);
    const prikazaniDatumStr = trenutniDatum.toDateString();
    const prikazJeDanas = prikazaniDatumStr === sada.toDateString();
    const prikazaniTerminiDivs = Array.from(rasporedDiv.querySelectorAll('.termin'));
    if (prikazaniTerminiDivs.length === 0) return; // Nema termina za ažuriranje

    let nextUpcomingEventIndexOnDisplayedDay = -1;
    let nextUpcomingEventStartTime = null;
     if (prikazJeDanas) {
         const rasporedZaDan = rasporedData.filter(p => {
             const predDatum = parseJSONDatum(p.datum);
             return !isNaN(predDatum.getTime()) && predDatum.toDateString() === prikazaniDatumStr;
         }).sort((a, b) => a.vrijemePocetkaObj.getTime() - b.vrijemePocetkaObj.getTime());

         for (let i = 0; i < rasporedZaDan.length; i++) {
            const termin = rasporedZaDan[i];
            const vrijemeKrajaTermina = new Date(trenutniDatum);
            vrijemeKrajaTermina.setHours(termin.vrijemeKrajaObj.getHours(), termin.vrijemeKrajaObj.getMinutes(), 0, 0);
            if (vrijemeKrajaTermina > sada) {
                 const originalIndex = rasporedData.findIndex(p => p === termin);
                 const correspondingDiv = rasporedDiv.querySelector(`[data-id="termin-${originalIndex}"]`);
                 if(correspondingDiv){
                     const divIndex = prikazaniTerminiDivs.indexOf(correspondingDiv);
                     if(divIndex !== -1){
                         nextUpcomingEventIndexOnDisplayedDay = divIndex;
                         nextUpcomingEventStartTime = new Date(trenutniDatum);
                         nextUpcomingEventStartTime.setHours(termin.vrijemePocetkaObj.getHours(), termin.vrijemePocetkaObj.getMinutes(), 0, 0);
                         break;
                     }
                 }
            }
        }
    }

    prikazaniTerminiDivs.forEach((terminDiv, divIndex) => {
        const dataId = terminDiv.dataset.id;
        if (!dataId) return;
        const originalIndex = parseInt(dataId.split('-')[1], 10);
        const statusTextSpan = terminDiv.querySelector('.status-text span');
        const timerTextP = terminDiv.querySelector('.timer-text');
        const timerTextSpan = timerTextP?.querySelector('span');
        const progressBarFill = terminDiv.querySelector('.progress-bar-fill');
        if (isNaN(originalIndex) || !statusTextSpan || !timerTextP || !timerTextSpan || !progressBarFill) return;
        const termin = rasporedData[originalIndex];
        if (!termin || !termin.vrijemePocetkaObj || !termin.vrijemeKrajaObj) return;

        const vrijemePocetka = new Date(trenutniDatum);
        vrijemePocetka.setHours(termin.vrijemePocetkaObj.getHours(), termin.vrijemePocetkaObj.getMinutes(), 0, 0);
        const vrijemeKraja = new Date(trenutniDatum);
        vrijemeKraja.setHours(termin.vrijemeKrajaObj.getHours(), termin.vrijemeKrajaObj.getMinutes(), 0, 0);

        terminDiv.classList.remove('active', 'zavrseno', 'next-up');
        timerTextP.style.display = 'none';
        timerTextP.classList.remove('active-timer', 'next-up-timer');
        progressBarFill.style.width = '0%';
        let statusText = "";
        let timerString = "";

        if (!prikazJeDanas && vrijemeKraja < sada) { terminDiv.classList.add('zavrseno'); statusText = "Završeno."; }
        else if (!prikazJeDanas && vrijemePocetka > sada ) { statusText = `Počinje u ${termin.terminPocetak}.`; }
        else if (prikazJeDanas && sada < vrijemePocetka) {
            statusText = `Počinje u ${termin.terminPocetak}.`;
            if (divIndex === nextUpcomingEventIndexOnDisplayedDay && nextUpcomingEventStartTime) {
                 terminDiv.classList.add('next-up');
                 const diffMs = nextUpcomingEventStartTime.getTime() - sada.getTime();
                 timerString = `Počinje za: ${formatirajVremenskuRazliku(diffMs)}`;
                 timerTextP.style.display = 'flex';
                 timerTextP.classList.add('next-up-timer');
            }
        } else if (prikazJeDanas && sada >= vrijemePocetka && sada <= vrijemeKraja) {
            terminDiv.classList.add('active');
            statusText = `U tijeku`;
            const diffMs = vrijemeKraja.getTime() - sada.getTime();
            timerString = `Završava za: ${formatirajVremenskuRazliku(diffMs, true)}`;
            timerTextP.style.display = 'flex';
            timerTextP.classList.add('active-timer');
            const ukupnoTrajanjeMs = vrijemeKraja.getTime() - vrijemePocetka.getTime();
            if (ukupnoTrajanjeMs > 0) {
                 const protekloVrijemeMs = sada.getTime() - vrijemePocetka.getTime();
                 const progressPercentage = Math.min(100, (protekloVrijemeMs / ukupnoTrajanjeMs) * 100);
                 progressBarFill.style.width = `${progressPercentage}%`;
            } else { progressBarFill.style.width = '0%'; }
        } else { terminDiv.classList.add('zavrseno'); statusText = "Završeno."; progressBarFill.style.width = '100%'; }

        statusTextSpan.textContent = statusText;
        if (timerString && timerTextSpan) { // Provjeri postoji li i span
            timerTextSpan.textContent = timerString;
        } else if(timerTextP){ // Sakrij P ako nema stringa
             timerTextP.style.display = 'none';
        }
    });
}

// --- Pomoćne Funkcije ---
function azurirajSamoVrijeme(sada = new Date()) { if (vrijemeInfoP) vrijemeInfoP.innerText = `Trenutno vrijeme: ${sada.toLocaleTimeString("hr-HR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`; }
function parseVrijeme(vrijemeStr) { if (!vrijemeStr || typeof vrijemeStr !== 'string') return null; const parts = vrijemeStr.split(':'); if (parts.length !== 2) return null; const [hours, minutes] = parts.map(Number); if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) { console.warn("Neispravan format vremena:", vrijemeStr); return null; } const date = new Date(0); date.setUTCHours(hours, minutes, 0, 0); return date; }
function parseJSONDatum(datumStr) { if (!datumStr || typeof datumStr !== 'string') return new Date('invalid date'); const parts = datumStr.replace(/\.$/, '').split('.'); if (parts.length !== 3) { console.warn("Neispravan format datuma:", datumStr); return new Date('invalid date');} const [day, month, year] = parts.map(Number); if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) { const d = new Date(Date.UTC(year, month - 1, day)); if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) return d; } console.warn("Neuspješno parsiranje datuma:", datumStr); return new Date('invalid date'); }
function formatirajVremenskuRazliku(ms, showSeconds = false) { if (ms < 0) ms = 0; let seconds = Math.floor(ms / 1000); let minutes = Math.floor(seconds / 60); let hours = Math.floor(minutes / 60); seconds %= 60; minutes %= 60; let parts = []; if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}min`); if (hours === 0 && showSeconds) { if (minutes > 0 || seconds > 0) parts.push(`${seconds}s`); else if (ms > 0) return "< 1s"; } if (parts.length === 0) { if (showSeconds && ms > 0) return "< 1s"; if (!showSeconds && ms > 0) return "< 1min"; return showSeconds ? "0s" : "0min"; } return parts.join(' '); }
function promijeniDan(pomak) { trenutniDatum.setDate(trenutniDatum.getDate() + pomak); prikaziRaspored(trenutniDatum); }