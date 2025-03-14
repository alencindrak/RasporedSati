// Funkcija za parsiranje datuma u formatu "DD.MM.YYYY."
function parseJSONDatum(datumStr) {
  datumStr = datumStr.replace(/\.$/, ''); // Ukloni završnu točku ako postoji
  const [day, month, year] = datumStr.split('.').map(Number);
  return new Date(year, month - 1, day);
}

async function ucitajRaspored() {
  try {
    const response = await fetch('raspored2.json');
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Greška pri učitavanju rasporeda", error);
    return [];
  }
}

async function prikaziRaspored() {
  const raspored = await ucitajRaspored();
  const danas = new Date();
  const danasString = danas.toDateString();
  const trenutnoVrijeme = new Date();
  document.getElementById("trenutnoVrijeme").innerText = `Trenutno vrijeme: ${trenutnoVrijeme.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}`;
  
  let html = "";

  raspored.forEach(predavanje => {
    const predavanjeDatum = parseJSONDatum(predavanje.datum);
    
    if (predavanjeDatum.toDateString() === danasString) {
      const pocetak = predavanje.terminPocetak;
      const kraj = predavanje.terminKraj;
      let [satPocetak, minPocetak] = pocetak.split(":").map(Number);
      let [satKraj, minKraj] = kraj.split(":").map(Number);
      
      let vrijemePocetka = new Date();
      vrijemePocetka.setHours(satPocetak, minPocetak, 0);
      
      let vrijemeKraja = new Date();
      vrijemeKraja.setHours(satKraj, minKraj, 0);
      
      let status = "";
      let activeClass = "";

      if (trenutnoVrijeme < vrijemePocetka) {
        let preostaloMinuta = Math.floor((vrijemePocetka - trenutnoVrijeme) / 60000);
        let sati = Math.floor(preostaloMinuta / 60);
        let minute = preostaloMinuta % 60;
        status = `Predmet još nije počeo. Počinje za ${sati} sat(i) i ${minute} minuta.`;
      } else if (trenutnoVrijeme >= vrijemePocetka && trenutnoVrijeme <= vrijemeKraja) {
        let preostaloSekundi = Math.floor((vrijemeKraja - trenutnoVrijeme) / 1000);
        let preostaloMinuta = Math.floor(preostaloSekundi / 60);
        status = `Predmet je u tijeku. Još ${preostaloMinuta} min do kraja.`;
        activeClass = "active";
        startProgressBar(vrijemePocetka, vrijemeKraja);
      } else {
        status = "Predmet je završen.";
        activeClass = "zavrseno";
      }

      let tipKlasa = predavanje.tip === "Vježbe" ? "vjezba" : "predavanje";
      
      html += `<div class='${tipKlasa} ${activeClass}'>
                  <h3>${predavanje.predmet}</h3>
                  <p>Početak: ${pocetak} - Kraj: ${kraj}</p>
                  <p>Tip: ${predavanje.tip}</p>
                  <p>${status}</p>
                </div>`;
    }
  });

  document.getElementById("raspored").innerHTML = html || "Danas nema predavanja.";
}

function startProgressBar(vrijemePocetka, vrijemeKraja) {
  let progress = document.getElementById("progress");
  let progressText = document.getElementById("progress-text");
  
  if (!progressText) {
    progressText = document.createElement("p");
    progressText.id = "progress-text";
    progressText.style.marginTop = "10px";
    progressText.style.textAlign = "center";
    progressText.style.color = "#333";
    progress.parentElement.after(progressText);
  }

  let totalDuration = Math.floor((vrijemeKraja - vrijemePocetka) / 1000);
  
  let interval = setInterval(function() {
    let trenutnoVrijeme = new Date();
    
    let preostaloSekundi = Math.floor((vrijemeKraja - trenutnoVrijeme) / 1000);
    
    if (preostaloSekundi < 0) {
      clearInterval(interval);
      progress.style.width = '100%';
      progressText.innerText = "100% završeno";
      return;
    }

    let width = ((totalDuration - preostaloSekundi) / totalDuration) * 100;
    progress.style.width = Math.min(width, 100) + '%';
    progressText.innerText = `${Math.round(width)}% završeno`;
  }, 1000);
}

setInterval(prikaziRaspored, 60000);
prikaziRaspored();