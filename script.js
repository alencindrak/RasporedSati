// <<< POČETAK script.js - Numeričko parsiranje vremena + Ispravljeno filtriranje datuma >>>
document.addEventListener('DOMContentLoaded', init);

// --- Globalne Varijable i Konstante ---
let rasporedData = [];
let trenutniDatum = new Date(); // Lokalno vrijeme korisnika
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
    console.log("INIT: Pokretanje...");
    setupTheme();
    prevDayBtn.addEventListener('click', () => promijeniDan(-1));
    nextDayBtn.addEventListener('click', () => promijeniDan(1));
    todayBtn.addEventListener('click', () => {
        const danas = new Date();
        if (toISODateString(trenutniDatum) !== toISODateString(danas)) { // String usporedba
            console.log("INIT: Vraćanje na današnji dan.");
            prikaziRaspored(danas);
        } else {
            console.log("INIT: Već smo na današnjem danu.");
        }
    });
    themeToggle.addEventListener('change', handleThemeToggle);

    try {
        console.log("INIT: Dohvaćanje raspored2.json...");
        const response = await fetch('raspored2.json');
        if (!response.ok) {
            console.error(`INIT: HTTP greška! Status: ${response.status}, StatusText: ${response.statusText}`);
            throw new Error(`HTTP greška! status: ${response.status}`);
        }
        console.log("INIT: Odgovor OK, parsiranje JSON-a...");
        const data = await response.json();
        console.log("INIT: JSON parsiran, mapiranje i filtriranje podataka...");

        // *** IZMIJENJENO: Koristi parseVrijemeNumerically ***
        rasporedData = data.data.map(item => ({
            ...item,
            datumObj: parseJSONDatum(item.datum), // Vraća UTC ponoć Date
            // Parsiraj vrijeme u {hours, minutes}
            parsedVrijemePocetka: parseVrijemeNumerically(item.terminPocetak),
            parsedVrijemeKraja: parseVrijemeNumerically(item.terminKraj)
        })).filter(item => // Filtriraj ako bilo što nije uspjelo
            item.datumObj && !isNaN(item.datumObj.getTime()) &&
            item.parsedVrijemePocetka && item.parsedVrijemeKraja
        );


        if (rasporedData.length === 0 && data.data.length > 0) {
             console.warn("INIT: Nema uspješno parsiranih termina! Provjerite format podataka.");
        } else {
            console.log(`INIT: Uspješno mapirano ${rasporedData.length} termina.`);
        }

        // *** IZMIJENJENO: Sortiranje koristi minute od ponoći ***
        rasporedData.sort((a, b) => {
            if (isNaN(a.datumObj?.getTime())) return 1;
            if (isNaN(b.datumObj?.getTime())) return -1;
            // Sortiraj prvo po datumu (UTC timestamp je ok za ovo)
            if (a.datumObj.getTime() !== b.datumObj.getTime()) {
                return a.datumObj.getTime() - b.datumObj.getTime();
            }
            // Ako je isti datum, sortiraj po vremenu početka (minute od ponoći)
            if (a.parsedVrijemePocetka && b.parsedVrijemePocetka) {
                const minutesA = a.parsedVrijemePocetka.hours * 60 + a.parsedVrijemePocetka.minutes;
                const minutesB = b.parsedVrijemePocetka.hours * 60 + b.parsedVrijemePocetka.minutes;
                return minutesA - minutesB;
            }
            return 0;
        });
        console.log("INIT: Raspored sortiran.");

        prikaziRaspored(trenutniDatum);
        clearInterval(updateIntervalId);
        updateIntervalId = setInterval(azurirajPrikaz, 1000);
        azurirajPrikaz();
        registerServiceWorker();
        console.log("INIT: Inicijalizacija uspješno završena.");

    } catch (error) {
        console.error("INIT: Greška pri učitavanju ili obradi rasporeda:", error);
        rasporedDiv.innerHTML = `<p style="color: red; font-weight: bold;">Greška! Raspored se nije mogao učitati.</p><p>Detalji greške: ${error.message}</p><p>Provjerite konzolu (F12) za više informacija i je li datoteka 'raspored2.json' dostupna.</p>`;
        prikazaniDatumH2.innerText = "Greška";
    }
}

// --- Funkcije za Temu --- (Iste kao prije)
function setupTheme() { const savedTheme = localStorage.getItem(LS_THEME_KEY); const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; if (savedTheme === 'dark' || (!savedTheme && prefersDark)) { document.body.classList.add('dark-mode'); themeToggle.checked = true; } else { document.body.classList.remove('dark-mode'); themeToggle.checked = false; } updateMetaThemeColor(); }
function handleThemeToggle() { if (themeToggle.checked) { enableDarkMode(); } else { disableDarkMode(); } }
function enableDarkMode(save = true) { document.body.classList.add('dark-mode'); if (save) localStorage.setItem(LS_THEME_KEY, 'dark'); updateMetaThemeColor(); }
function disableDarkMode(save = true) { document.body.classList.remove('dark-mode'); if (save) localStorage.setItem(LS_THEME_KEY, 'light'); updateMetaThemeColor(); }
function updateMetaThemeColor() { const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--header-bg').trim(); if (metaThemeColor) { metaThemeColor.setAttribute('content', headerBgColor); } }

// --- Registracija SW --- (Ista kao prije)
function registerServiceWorker() { if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/service-worker.js').then(reg => console.log('SW reg:', reg.scope)).catch(err => console.error('SW reg fail:', err)); }); } else { console.log('SW nije podržan.'); } }

// --- Pomoćna funkcija za formatiranje u YYYY-MM-DD --- (Ista kao prije)
function toISODateString(date) { if (!date || isNaN(date.getTime())) return null; const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }

// --- Prikaz Rasporeda --- (Koristi numerička vremena)
function prikaziRaspored(datum) {
    console.log(`PRIKAZ: Prikazujem raspored za ${datum.toLocaleDateString('hr-HR')}`);
    trenutniDatum = new Date(datum);
    trenutniDatum.setHours(0, 0, 0, 0); // Reset na lokalnu ponoć

    rasporedDiv.innerHTML = '';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    prikazaniDatumH2.innerText = trenutniDatum.toLocaleDateString("hr-HR", options);
    const danas = new Date(); danas.setHours(0,0,0,0);
    prikazaniDatumH2.classList.toggle('danasnji-datum', toISODateString(trenutniDatum) === toISODateString(danas));

    // Provjera ispitnih rokova (ista logika)
    const datumZaUsporedbu = new Date(trenutniDatum);
    let jeIspitniRok = false; /* ... ostatak provjere ... */
    let trenutniRokInfo = null; for (const rok of ispitniRokovi) { const pocetakRokaDan = new Date(rok.pocetak); pocetakRokaDan.setHours(0,0,0,0); const krajRokaDan = new Date(rok.kraj); krajRokaDan.setHours(0,0,0,0); if (datumZaUsporedbu >= pocetakRokaDan && datumZaUsporedbu <= krajRokaDan) { jeIspitniRok = true; trenutniRokInfo = rok; console.log("PRIKAZ: Dan je unutar ispitnog roka."); break; } } if (jeIspitniRok && trenutniRokInfo) { rasporedDiv.innerHTML = `<div class="ispitni-rok-info"><h3><i class="fas fa-calendar-alt fa-fw"></i> Ispitni Rok</h3><p>U tijeku su ispitni rokovi.</p><p>(Od ${trenutniRokInfo.pocetak.toLocaleDateString('hr-HR')} do ${trenutniRokInfo.kraj.toLocaleDateString('hr-HR')})</p></div>`; azurirajSamoVrijeme(); return; }


    // Filtriranje datuma (isto kao prije)
    const targetDateString = toISODateString(trenutniDatum);
    const rasporedZaDatum = rasporedData.filter(p => {
         const itemDate = p.datumObj ? new Date(p.datumObj.getUTCFullYear(), p.datumObj.getUTCMonth(), p.datumObj.getUTCDate()) : null;
         return toISODateString(itemDate) === targetDateString;
    });


    if (rasporedZaDatum.length === 0) {
        console.log("PRIKAZ: Nema termina za ovaj dan nakon filtriranja.");
        rasporedDiv.innerHTML = '<p>Nema predavanja za ovaj dan.</p>';
        azurirajSamoVrijeme(); return;
    }
    console.log(`PRIKAZ: Pronađeno ${rasporedZaDatum.length} termina.`);

    // Odredi 'next-up'
    const sada = new Date();
    let nextUpOriginalIndex = -1;
    if (toISODateString(trenutniDatum) === toISODateString(danas)) {
        for (let i = 0; i < rasporedZaDatum.length; i++) {
            const termin = rasporedZaDatum[i];
             // *** Koristi parsedVrijemeKraja za usporedbu ***
             const vrijemeKrajaTermina = new Date(trenutniDatum);
             vrijemeKrajaTermina.setHours(termin.parsedVrijemeKraja.hours, termin.parsedVrijemeKraja.minutes, 59, 999);
             if (vrijemeKrajaTermina > sada) {
                const originalIndex = rasporedData.findIndex(p => p === termin);
                if (originalIndex !== -1) { nextUpOriginalIndex = originalIndex; break; }
             }
        }
         console.log(`PRIKAZ: 'next-up' index: ${nextUpOriginalIndex}`);
    }

    // Generiranje HTML-a
    const fragment = document.createDocumentFragment();
    rasporedZaDatum.forEach((predavanje, index) => { /* ... generiranje HTML-a ... */
        const terminDiv = document.createElement('div');
        terminDiv.className = `termin ${predavanje.tip === 'Vježbe' ? 'vjezbe' : 'predavanje'}`;
        const originalIndex = rasporedData.findIndex(p => p === predavanje);
        if (originalIndex !== -1) { terminDiv.dataset.id = `termin-${originalIndex}`; if (originalIndex === nextUpOriginalIndex) { terminDiv.classList.add('next-up'); } }
        else { console.warn("PRIKAZ: Nije pronađen originalni index za:", predavanje); }
        terminDiv.innerHTML = `<h3>${predavanje.predmet}</h3><p><i class="fa-regular fa-clock fa-fw"></i> ${predavanje.terminPocetak || 'N/A'} - ${predavanje.terminKraj || 'N/A'}</p><p><i class="${predavanje.tip === 'Vježbe' ? 'fas fa-tools' : 'fas fa-book-open'} fa-fw"></i> Tip: ${predavanje.tip || 'N/A'}</p><p><i class="fa-solid fa-location-dot fa-fw"></i> ${predavanje.dvorana || 'N/A'}</p><p><i class="fa-solid fa-user-tie fa-fw"></i> ${predavanje.nastavnik || 'N/A'}</p><div class="termin-status-container"><p class="status-text"><i class="fa-solid fa-circle-info fa-fw"></i> <span>Učitavanje...</span></p><p class="timer-text" style="display: none;"><i class="fa-solid fa-hourglass-half fa-fw"></i> <span></span></p></div><div class="progress-bar-container"><div class="progress-bar-fill"></div></div>`;
        fragment.appendChild(terminDiv);

        // Pauza
        const sljedeciTermin = rasporedZaDatum[index + 1];
        if (sljedeciTermin && predavanje.parsedVrijemeKraja && sljedeciTermin.parsedVrijemePocetka) {
            // *** Koristi parsedVrijeme za pauzu ***
            const krajTrenutnog = new Date(trenutniDatum);
            krajTrenutnog.setHours(predavanje.parsedVrijemeKraja.hours, predavanje.parsedVrijemeKraja.minutes, 0, 0);
            const pocetakSljedeceg = new Date(trenutniDatum);
            pocetakSljedeceg.setHours(sljedeciTermin.parsedVrijemePocetka.hours, sljedeciTermin.parsedVrijemePocetka.minutes, 0, 0);
            const razlikaMs = pocetakSljedeceg.getTime() - krajTrenutnog.getTime();
            if (razlikaMs > 60000) { /* ... dodaj pauzaDiv ... */
                const pauzaDiv = document.createElement('div'); pauzaDiv.className = 'pauza-info'; pauzaDiv.innerHTML = `<i class="fas fa-mug-hot"></i> Pauza: ${formatirajVremenskuRazliku(razlikaMs)}`; fragment.appendChild(pauzaDiv);
             }
        }
    });
    rasporedDiv.appendChild(fragment);
    azurirajPrikaz();
}


// --- Ažuriranje Prikaza --- (Koristi numerička vremena)
function azurirajPrikaz() {
    const sada = new Date();
    azurirajSamoVrijeme(sada);

    const danas = new Date();
    danas.setHours(0, 0, 0, 0);
    const prikazJeDanas = toISODateString(trenutniDatum) === toISODateString(danas);

    const prikazaniTerminiDivs = Array.from(rasporedDiv.querySelectorAll('.termin[data-id]'));

    if (rasporedDiv.querySelector('.ispitni-rok-info') || prikazaniTerminiDivs.length === 0) { return; }

    // Ponovno odredi 'next-up'
     let nextUpcomingOriginalIndex = -1;
     let nextUpcomingStartTime = null; // LOKALNO vrijeme
     if (prikazJeDanas) {
         const targetDateString = toISODateString(danas);
         const rasporedZaDanas = rasporedData.filter(p => {
             const itemDate = p.datumObj ? new Date(p.datumObj.getUTCFullYear(), p.datumObj.getUTCMonth(), p.datumObj.getUTCDate()) : null;
             return toISODateString(itemDate) === targetDateString;
         });

         for (const termin of rasporedZaDanas) {
             if (termin.parsedVrijemeKraja && termin.parsedVrijemePocetka) {
                 // *** Koristi parsedVrijemeKraja ***
                 const vrijemeKrajaTermina = new Date(danas);
                 vrijemeKrajaTermina.setHours(termin.parsedVrijemeKraja.hours, termin.parsedVrijemeKraja.minutes, 59, 999);
                 if (vrijemeKrajaTermina > sada) {
                      const originalIndex = rasporedData.findIndex(p => p === termin);
                      if(originalIndex !== -1) {
                          nextUpcomingOriginalIndex = originalIndex;
                          // *** Koristi parsedVrijemePocetka ***
                          nextUpcomingStartTime = new Date(danas);
                          nextUpcomingStartTime.setHours(termin.parsedVrijemePocetka.hours, termin.parsedVrijemePocetka.minutes, 0, 0);
                          break;
                      }
                 }
             }
         }
    }

    // Ažuriranje svakog termina
    prikazaniTerminiDivs.forEach(terminDiv => {
        const dataId = terminDiv.dataset.id;
        const originalIndexStr = dataId?.split('-')[1];
        if (!originalIndexStr) return;
        const originalIndex = parseInt(originalIndexStr, 10);

        const statusTextSpan = terminDiv.querySelector('.status-text span'); /* ... dohvati ostale elemente ... */
        const timerTextP = terminDiv.querySelector('.timer-text'); const timerTextSpan = timerTextP?.querySelector('span'); const progressBarFill = terminDiv.querySelector('.progress-bar-fill'); const progressBarContainer = terminDiv.querySelector('.progress-bar-container');
        if (isNaN(originalIndex) || originalIndex < 0 || originalIndex >= rasporedData.length || !statusTextSpan || !timerTextP || !timerTextSpan || !progressBarFill || !progressBarContainer) { return; }

        const termin = rasporedData[originalIndex];
        // *** Provjeri parsedVrijeme... ***
        if (!termin || !termin.parsedVrijemePocetka || !termin.parsedVrijemeKraja) { statusTextSpan.textContent = "Greška"; return; }

        // *** Kreiraj LOKALNE Date objekte za usporedbu koristeći parsedVrijeme... ***
        const vrijemePocetka = new Date(trenutniDatum);
        vrijemePocetka.setHours(termin.parsedVrijemePocetka.hours, termin.parsedVrijemePocetka.minutes, 0, 0);

        const vrijemeKraja = new Date(trenutniDatum);
        vrijemeKraja.setHours(termin.parsedVrijemeKraja.hours, termin.parsedVrijemeKraja.minutes, 59, 999);

        // Resetiraj stanje
        terminDiv.classList.remove('active', 'zavrseno', 'next-up'); /* ... resetiraj ostalo ... */
        timerTextP.style.display = 'none'; timerTextP.classList.remove('active-timer', 'next-up-timer'); progressBarFill.style.width = '0%'; progressBarContainer.style.display = 'none';
        let statusText = ""; let timerString = "";

        // --- Logika statusa (trebala bi sada biti točna) ---
        if (sada > vrijemeKraja && prikazJeDanas) {
            terminDiv.classList.add('zavrseno'); statusText = "Završeno."; progressBarFill.style.width = '100%'; progressBarContainer.style.display = 'block';
        } else if (sada < vrijemePocetka && prikazJeDanas) {
            statusText = `Počinje u ${termin.terminPocetak}.`;
            if (originalIndex === nextUpcomingOriginalIndex && nextUpcomingStartTime) {
                 terminDiv.classList.add('next-up');
                 const diffMs = nextUpcomingStartTime.getTime() - sada.getTime();
                 if (diffMs >= 0) { timerString = `Počinje za: ${formatirajVremenskuRazliku(diffMs)}`; timerTextP.style.display = 'flex'; timerTextP.classList.add('next-up-timer'); }
            }
        } else if (sada >= vrijemePocetka && sada <= vrijemeKraja && prikazJeDanas) {
            terminDiv.classList.add('active'); statusText = `U tijeku`;
            const diffMs = vrijemeKraja.getTime() - sada.getTime();
            if (diffMs >= 0) { timerString = `Završava za: ${formatirajVremenskuRazliku(diffMs, true)}`; timerTextP.style.display = 'flex'; timerTextP.classList.add('active-timer'); }
            else { timerString = `Završava za: 0s`; timerTextP.style.display = 'flex'; timerTextP.classList.add('active-timer');}

            // *** Koristi parsedVrijeme za progress bar ***
            const pocetakZaProgress = new Date(trenutniDatum);
            pocetakZaProgress.setHours(termin.parsedVrijemePocetka.hours, termin.parsedVrijemePocetka.minutes, 0, 0);
            const krajZaProgress = new Date(trenutniDatum); // Koristi kraj minute
            krajZaProgress.setHours(termin.parsedVrijemeKraja.hours, termin.parsedVrijemeKraja.minutes, 59, 999);
            const ukupnoTrajanjeMs = krajZaProgress.getTime() - pocetakZaProgress.getTime();
            if (ukupnoTrajanjeMs > 0) {
                 const protekloVrijemeMs = sada.getTime() - pocetakZaProgress.getTime();
                 const progressPercentage = Math.min(100, Math.max(0,(protekloVrijemeMs / ukupnoTrajanjeMs) * 100));
                 progressBarFill.style.width = `${progressPercentage}%`; progressBarContainer.style.display = 'block';
            }
        } else if (trenutniDatum < danas) {
             terminDiv.classList.add('zavrseno'); statusText = "Završeno."; progressBarFill.style.width = '100%'; progressBarContainer.style.display = 'block';
        } else if (trenutniDatum > danas) {
             statusText = `Počinje u ${termin.terminPocetak}.`;
        } else {
             statusText = `Status nepoznat`; console.warn("AZURIRAJ: Nepokriveno stanje za:", termin);
        }

        // Ažuriraj tekst
        statusTextSpan.textContent = statusText;
        if (timerString && timerTextSpan) { timerTextSpan.textContent = timerString; }
        else { timerTextP.style.display = 'none'; }
    });
}


// --- Pomoćne Funkcije ---

// Ispravljeno za točan prikaz trenutnog vremena
function azurirajSamoVrijeme(sada = new Date()) { if (vrijemeInfoP) { const h = sada.getHours().toString().padStart(2, '0'); const m = sada.getMinutes().toString().padStart(2, '0'); const s = sada.getSeconds().toString().padStart(2, '0'); vrijemeInfoP.innerText = `Trenutno vrijeme: ${h}:${m}:${s}`; } }

// *** NOVO: Parsira vrijeme u {hours, minutes} ***
function parseVrijemeNumerically(vrijemeStr) {
    if (!vrijemeStr || typeof vrijemeStr !== 'string') return null;
    const parts = vrijemeStr.split(':');
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn("PARSE_VRIJEME_NUM: Neispravan format:", vrijemeStr); return null;
    }
    return { hours, minutes };
}

// *** Stara parseVrijeme se VIŠE NE KORISTI ***
// function parseVrijeme(vrijemeStr) { ... }

// Parsira datum u UTC ponoć Date objekt
function parseJSONDatum(datumStr) { if (!datumStr || typeof datumStr !== 'string') return new Date('invalid date'); const cleanDatumStr = datumStr.replace(/\.$/, ''); const parts = cleanDatumStr.split('.'); if (parts.length !== 3) { console.warn("PARSE_DATUM: Neispravan format:", datumStr); return new Date('invalid date'); } const [day, month, year] = parts.map(Number); if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >=1 && day <= 31) { const d = new Date(Date.UTC(year, month - 1, day)); if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) { return d; } else { console.warn(`PARSE_DATUM: Datum "${datumStr}" nevažeći.`); return new Date('invalid date'); } } console.warn("PARSE_DATUM: Neuspješno parsiranje:", datumStr); return new Date('invalid date'); }

// Formatira razliku (ista kao prije)
function formatirajVremenskuRazliku(ms, showSeconds = false) { if (ms < 0) ms = 0; let totalSeconds = Math.floor(ms / 1000); let hours = Math.floor(totalSeconds / 3600); let minutes = Math.floor((totalSeconds % 3600) / 60); let seconds = totalSeconds % 60; let parts = []; if (hours > 0) parts.push(`${hours}h`); if (minutes > 0) parts.push(`${minutes}min`); if (hours === 0 && showSeconds) { if (minutes > 0 || seconds > 0) { parts.push(`${seconds}s`); } else if (ms > 0) { return "< 1s"; } } if (parts.length === 0) { if (showSeconds && ms > 0) return "< 1s"; if (!showSeconds && ms > 0) return "< 1min"; return showSeconds ? "0s" : "0min"; } return parts.join(' '); }

// Mijenja dan (ista kao prije)
function promijeniDan(pomak) { const noviDatum = new Date(trenutniDatum); noviDatum.setDate(noviDatum.getDate() + pomak); prikaziRaspored(noviDatum); }
// <<< KRAJ script.js >>>