// Funkcija za parsiranje datuma u formatu "DD.MM.YYYY."
function parseJSONDatum(datumStr) {
  // Ukloni završnu točku ako postoji
  datumStr = datumStr.replace(/\.$/, '');
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
  // Formatiraj današnji datum za usporedbu (bez vremena)
  const danasString = danas.toDateString();
  
  const trenutnoVrijeme = new Date();
  document.getElementById("trenutnoVrijeme").innerText = `Trenutno vrijeme: ${trenutnoVrijeme.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}`;
  
  let html = "";
  raspored.forEach(predavanje => {
    // Parsiraj datum iz JSON-a
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
        status = `Predmet još nije počeo. Počinje u ${pocetak} i završava u ${kraj}.`;
      } else if (trenutnoVrijeme >= vrijemePocetka && trenutnoVrijeme <= vrijemeKraja) {
        let preostaloMinuta = Math.floor((vrijemeKraja - trenutnoVrijeme) / 60000);
        status = `Predmet je u tijeku. Još ${preostaloMinuta} min do kraja.`;
        activeClass = "active";
      } else {
        status = "Predmet je završen.";
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

setInterval(prikaziRaspored, 60000);
prikaziRaspored();
