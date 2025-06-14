document.addEventListener('DOMContentLoaded', () => {
  // DOM-Elemente abrufen
  const form = document.getElementById('kalorien-form');
  const input = form.querySelector('input[name="name"]');
  const submitButton = document.getElementById('submit-button');
  const tableBody = document.querySelector('#kalorien-tabelle tbody');
  const clearButton = document.getElementById('clear-table');

  // Summen-Felder
  const sumKcal = document.getElementById('sum-kcal');
  const sumKH = document.getElementById('sum-kohlenhydrate');
  const sumEiweiss = document.getElementById('sum-eiweiss');
  const sumFett = document.getElementById('sum-fett');

  // GPT API-Endpunkt
  const VAL_TOWN_ENDPOINT = 'https://lucadiez--9cf7338499304ad889073a7975e3f745.web.val.run';
  const MAX_HISTORY_LENGTH = 10;

  // Einmalige UUID pro Gerät für lokale Speicherung
  if (!localStorage.getItem('uuid')) {
    localStorage.setItem('uuid', crypto.randomUUID());
  }
  const uuid = localStorage.getItem('uuid');

  // Bisherige gespeicherte Einträge laden
  let gespeicherteEintraege = JSON.parse(localStorage.getItem('eintraege') || '[]');

  // GPT-Kontext mit Systemanweisung
  let messageHistory = {
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `
        Du bist ein Kalorien-Tracker. Der Nutzer beschreibt in Alltagssprache, was er gegessen hat.
        Deine Aufgabe ist es, die Angaben in folgendes JSON-Format zu bringen:

        {
          "gerichte": [
            {
              "name": "Pizza Tonno",
              "menge": "1 Portion",
              "kcal": 850,
              "kohlenhydrate": 95,
              "eiweiss": 30,
              "fett": 35
            }
          ]
        }

        Antworte ausschließlich mit JSON.
        `,
      },
    ],
  };

  // Bereits gespeicherte Einträge anzeigen
  gespeicherteEintraege.forEach(addToTable);
  updateSumme(); // Summen initial berechnen

  // Formular absenden
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userText = input.value.trim();
    if (!userText) return;

    // Ladeanimation starten: Button zeigt animierende Punkte statt Text
    let dotState = 0;
    const originalLabel = submitButton.textContent;
    let loadingInterval = setInterval(() => {
      dotState = (dotState + 1) % 4;
      submitButton.textContent = '.'.repeat(dotState) || '.';
    }, 400);
    submitButton.disabled = true;

    // Nutzereingabe an GPT senden
    messageHistory.messages.push({ role: 'user', content: userText });
    messageHistory = truncateHistory(messageHistory);
    input.value = '';

    try {
      // POST-Request an Val.town (GPT-Proxy)
      const response = await fetch(VAL_TOWN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageHistory),
      });

      // Fehlerbehandlung
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      // GPT-Antwort verarbeiten
      const json = await response.json();
      const reply = json.completion.choices[0].message;

      // Antwort ebenfalls in Verlauf speichern
      messageHistory.messages.push(reply);
      messageHistory = truncateHistory(messageHistory);

      // JSON-Content extrahieren
      const parsed = JSON.parse(reply.content);
      if (!parsed.gerichte) throw new Error('Fehlende "gerichte"-Struktur');

      // Neue Gerichte in Tabelle + Storage einfügen
      parsed.gerichte.forEach((gericht) => {
        gespeicherteEintraege.push(gericht);
        addToTable(gericht);
      });

      // Speicherung aktualisieren
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme(); // neue Summen berechnen

    } catch (err) {
      console.error(err);
      alert('Fehler beim Verarbeiten der Eingabe.');
    } finally {
      // Ladeanimation stoppen & Button zurücksetzen
      clearInterval(loadingInterval);
      submitButton.textContent = originalLabel;
      submitButton.disabled = false;
    }
  });

  // Tabelle komplett löschen
  clearButton.addEventListener('click', () => {
    if (confirm("Willst du wirklich alle Einträge löschen?")) {
      gespeicherteEintraege = [];
      localStorage.removeItem('eintraege');
      tableBody.innerHTML = '';
      updateSumme();
    }
  });

  // Eintrag als neue Tabellenzeile anzeigen
  function addToTable(entry) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td class="col-name">${entry.name}</td>
      <td class="col-menge">${entry.menge}</td>
      <td class="col-kcal">${entry.kcal}</td>
      <td class="col-kh">${entry.kohlenhydrate}</td>
      <td class="col-ew">${entry.eiweiss}</td>
      <td class="col-fett">${entry.fett}</td>
      <td class="col-aktion"><button class="delete-entry">✕</button></td>
    `;

    // Einzelnen Eintrag löschen
    row.querySelector('.delete-entry').addEventListener('click', () => {
      tableBody.removeChild(row);
      gespeicherteEintraege = gespeicherteEintraege.filter(e => !eintragGleich(e, entry));
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme();
    });

    tableBody.appendChild(row);
  }

  // Summen aus allen Einträgen berechnen
  function updateSumme() {
    let kcal = 0, kh = 0, eiw = 0, fett = 0;
    gespeicherteEintraege.forEach(e => {
      kcal += e.kcal || 0;
      kh += e.kohlenhydrate || 0;
      eiw += e.eiweiss || 0;
      fett += e.fett || 0;
    });

    sumKcal.textContent = kcal;
    sumKH.textContent = kh;
    sumEiweiss.textContent = eiw;
    sumFett.textContent = fett;
  }

  // GPT-Kontext kürzen (letzte X Nachrichten)
  function truncateHistory(history) {
    const [system, ...rest] = history.messages;
    const trimmed = rest.slice(-MAX_HISTORY_LENGTH);
    return { ...history, messages: [system, ...trimmed] };
  }

  // Zwei Einträge vergleichen (für Löschung)
  function eintragGleich(a, b) {
    return (
      a.name === b.name &&
      a.menge === b.menge &&
      a.kcal === b.kcal &&
      a.kohlenhydrate === b.kohlenhydrate &&
      a.eiweiss === b.eiweiss &&
      a.fett === b.fett
    );
  }
});
