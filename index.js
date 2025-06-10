document.addEventListener('DOMContentLoaded', () => {
  // DOM-Elemente holen
  const form = document.getElementById('kalorien-form');
  const input = form.querySelector('input[name="name"]');
  const tableBody = document.querySelector('#kalorien-tabelle tbody');
  const clearButton = document.getElementById('clear-table');

  // Elemente für die Gesamtsummen
  const sumKcal = document.getElementById('sum-kcal');
  const sumKH = document.getElementById('sum-kohlenhydrate');
  const sumEiweiss = document.getElementById('sum-eiweiss');
  const sumFett = document.getElementById('sum-fett');

  // API-Endpunkt (val.town GPT Schnittstelle)
  const VAL_TOWN_ENDPOINT = 'https://lucadiez--9cf7338499304ad889073a7975e3f745.web.val.run';
  const MAX_HISTORY_LENGTH = 10;

  // Einmalige UUID für das Gerät erzeugen (wenn noch nicht vorhanden)
  if (!localStorage.getItem('uuid')) {
    localStorage.setItem('uuid', crypto.randomUUID());
  }
  const uuid = localStorage.getItem('uuid');

  // Einträge aus dem localStorage holen
  let gespeicherteEintraege = JSON.parse(localStorage.getItem('eintraege') || '[]');

  // GPT-Kontext mit initialem System-Prompt
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

  // Bereits gespeicherte Einträge in Tabelle anzeigen
  gespeicherteEintraege.forEach(addToTable);
  updateSumme(); // Gesamtsummen berechnen

  // Formular absenden (Text an GPT schicken)
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Seite nicht neu laden

    const userText = input.value.trim();
    if (!userText) return;

    // Nutzereingabe an GPT-Kontext anhängen
    messageHistory.messages.push({ role: 'user', content: userText });
    messageHistory = truncateHistory(messageHistory);
    input.value = ''; // Eingabefeld leeren

    try {
      // Anfrage an GPT schicken
      const response = await fetch(VAL_TOWN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageHistory),
      });

      // Fehlerbehandlung bei Nicht-Erfolg
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      // Antwort verarbeiten
      const json = await response.json();
      const reply = json.completion.choices[0].message;

      // Antwort ebenfalls in Verlauf speichern
      messageHistory.messages.push(reply);
      messageHistory = truncateHistory(messageHistory);

      // JSON-Antwort parsen
      const parsed = JSON.parse(reply.content);
      if (!parsed.gerichte) throw new Error('Fehlende "gerichte"-Struktur');

      // Gerichte zur Tabelle und Speicherung hinzufügen
      parsed.gerichte.forEach((gericht) => {
        gespeicherteEintraege.push(gericht);
        addToTable(gericht);
      });

      // Aktualisieren im localStorage
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme(); // Gesamtsummen neu berechnen

    } catch (err) {
      console.error(err);
      alert('Fehler beim Verarbeiten der Eingabe.');
    }
  });

  // Button: Tabelle komplett leeren
  clearButton.addEventListener('click', () => {
    if (confirm("Willst du wirklich alle Einträge löschen?")) {
      gespeicherteEintraege = [];
      localStorage.removeItem('eintraege');
      tableBody.innerHTML = ''; // Tabelle leeren
      updateSumme(); // Summen zurücksetzen
    }
  });

  // Neue Zeile zur Tabelle hinzufügen
  function addToTable(entry) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.menge}</td>
      <td>${entry.kcal}</td>
      <td>${entry.kohlenhydrate}</td>
      <td>${entry.eiweiss}</td>
      <td>${entry.fett}</td>
      <td><button class="delete-entry">✕</button></td>
    `;

    // Einzelnen Eintrag löschen
    row.querySelector('.delete-entry').addEventListener('click', () => {
      tableBody.removeChild(row); // aus Tabelle löschen
      gespeicherteEintraege = gespeicherteEintraege.filter(e => !eintragGleich(e, entry));
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme(); // Summen neu berechnen
    });

    tableBody.appendChild(row); // in Tabelle einfügen
  }

  // Summen aktualisieren
  function updateSumme() {
    let kcal = 0, kh = 0, eiw = 0, fett = 0;

    // Werte aufsummieren
    gespeicherteEintraege.forEach(e => {
      kcal += e.kcal || 0;
      kh += e.kohlenhydrate || 0;
      eiw += e.eiweiss || 0;
      fett += e.fett || 0;
    });

    // Anzeige aktualisieren
    sumKcal.textContent = kcal;
    sumKH.textContent = kh;
    sumEiweiss.textContent = eiw;
    sumFett.textContent = fett;
  }

  // Verlauf kürzen (max. X letzte Nachrichten)
  function truncateHistory(history) {
    const [system, ...rest] = history.messages;
    const trimmed = rest.slice(-MAX_HISTORY_LENGTH);
    return { ...history, messages: [system, ...trimmed] };
  }

  // Vergleichsfunktion für Einträge (zum Löschen)
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
