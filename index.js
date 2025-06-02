document.addEventListener('DOMContentLoaded', () => {
  // Form und Eingabefeld aus dem DOM holen
  const form = document.getElementById('kalorien-form');
  const input = form.querySelector('input[name="name"]');
  const tableBody = document.querySelector('#kalorien-tabelle tbody');

  // Die URL zu deiner val.town GPT-Schnittstelle
  const VAL_TOWN_ENDPOINT = 'https://lucadiez--9cf7338499304ad889073a7975e3f745.web.val.run';

  // Maximale Länge der Chat-Historie
  const MAX_HISTORY_LENGTH = 10;

  // UUID für eindeutige Geräteerkennung erstellen (einmal pro Gerät)
  if (!localStorage.getItem('uuid')) {
    localStorage.setItem('uuid', crypto.randomUUID());
  }
  const uuid = localStorage.getItem('uuid');

  // Startkonfiguration des GPT-Chats mit Systemprompt
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
            },
            {
              "name": "gemischter Salat",
              "menge": "klein",
              "kcal": 100,
              "kohlenhydrate": 5,
              "eiweiss": 2,
              "fett": 6
            }
          ]
        }

        Antworte ausschließlich mit JSON.
        `,
      },
    ],
  };

  // Bestehende Einträge aus dem localStorage laden und anzeigen
  const gespeicherteEintraege = JSON.parse(localStorage.getItem('eintraege') || '[]');
  gespeicherteEintraege.forEach(addToTable);

  // Formular-Submit-Event behandeln
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Seite nicht neu laden

    const userText = input.value.trim(); // Nutzer-Eingabe holen
    if (!userText) return; // Wenn leer, nichts tun

    // Eingabe als neue Nutzer-Nachricht an den GPT-Kontext anhängen
    messageHistory.messages.push({ role: 'user', content: userText });
    messageHistory = truncateHistory(messageHistory); // Kontext begrenzen
    input.value = ''; // Eingabefeld leeren

    try {
      // Anfrage an val.town-Endpoint mit GPT-Kontext senden
      const response = await fetch(VAL_TOWN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageHistory),
      });

      // Fehlerbehandlung bei fehlerhafter Antwort
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      // Antwort parsen
      const json = await response.json();
      const reply = json.completion.choices[0].message;

      // Antwort in die Historie aufnehmen
      messageHistory.messages.push(reply);
      messageHistory = truncateHistory(messageHistory);

      // Antworttext als JSON parsen
      const parsed = JSON.parse(reply.content);

      // Prüfen, ob erwartete Struktur vorhanden ist
      if (!parsed.gerichte) throw new Error('Fehlende "gerichte"-Struktur');

      // Alle gelieferten Gerichte zur Tabelle und Speicherung hinzufügen
      parsed.gerichte.forEach((gericht) => {
        addToTable(gericht); // In Tabelle anzeigen
        gespeicherteEintraege.push(gericht); // In localStorage aufnehmen
      });

      // Neue Einträge im localStorage speichern
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
    } catch (err) {
      console.error(err);
      alert('Fehler beim Verarbeiten der Eingabe.');
    }
  });

  // Funktion zum Einfügen eines Eintrags in die Tabelle
  function addToTable(entry) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.menge}</td>
      <td>${entry.kcal} kcal<br>
          KH: ${entry.kohlenhydrate}g, Eiweiß: ${entry.eiweiss}g, Fett: ${entry.fett}g
      </td>
    `;
    tableBody.appendChild(row);
  }

  // Funktion zum Kürzen des Chat-Verlaufs (damit GPT nicht überläuft)
  function truncateHistory(history) {
    const [system, ...rest] = history.messages;
    const trimmed = rest.slice(-MAX_HISTORY_LENGTH); // Nur letzte n Nachrichten behalten
    return { ...history, messages: [system, ...trimmed] };
  }
});
