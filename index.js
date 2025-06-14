document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('kalorien-form');
  const input = form.querySelector('input[name="name"]');
  const submitButton = document.getElementById('submit-button');
  const tableBody = document.querySelector('#kalorien-tabelle tbody');
  const clearButton = document.getElementById('clear-table');

  const sumKcal = document.getElementById('sum-kcal');
  const sumKH = document.getElementById('sum-kohlenhydrate');
  const sumEiweiss = document.getElementById('sum-eiweiss');
  const sumFett = document.getElementById('sum-fett');

  const VAL_TOWN_ENDPOINT = 'https://lucadiez--9cf7338499304ad889073a7975e3f745.web.val.run';
  const MAX_HISTORY_LENGTH = 10;

  if (!localStorage.getItem('uuid')) {
    localStorage.setItem('uuid', crypto.randomUUID());
  }
  const uuid = localStorage.getItem('uuid');

  let gespeicherteEintraege = JSON.parse(localStorage.getItem('eintraege') || '[]');

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

  gespeicherteEintraege.forEach(addToTable);
  updateSumme();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userText = input.value.trim();
    if (!userText) return;

    // Ladeanimation starten
    let dotState = 0;
    const originalLabel = submitButton.textContent;
    let loadingInterval = setInterval(() => {
      dotState = (dotState + 1) % 4;
      submitButton.textContent = '.'.repeat(dotState) || '.';
    }, 400);
    submitButton.disabled = true;

    messageHistory.messages.push({ role: 'user', content: userText });
    messageHistory = truncateHistory(messageHistory);
    input.value = '';

    try {
      const response = await fetch(VAL_TOWN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageHistory),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const json = await response.json();
      const reply = json.completion.choices[0].message;

      messageHistory.messages.push(reply);
      messageHistory = truncateHistory(messageHistory);

      const parsed = JSON.parse(reply.content);
      if (!parsed.gerichte) throw new Error('Fehlende "gerichte"-Struktur');

      parsed.gerichte.forEach((gericht) => {
        gespeicherteEintraege.push(gericht);
        addToTable(gericht);
      });

      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Verarbeiten der Eingabe.');
    } finally {
      // Ladeanimation beenden
      clearInterval(loadingInterval);
      submitButton.textContent = originalLabel;
      submitButton.disabled = false;
    }
  });

  clearButton.addEventListener('click', () => {
    if (confirm("Willst du wirklich alle Einträge löschen?")) {
      gespeicherteEintraege = [];
      localStorage.removeItem('eintraege');
      tableBody.innerHTML = '';
      updateSumme();
    }
  });

  function addToTable(entry) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.name}</td>
      <td class="hide-on-small">${entry.menge}</td>
      <td>${entry.kcal}</td>
      <td class="hide-on-small">${entry.kohlenhydrate}</td>
      <td>${entry.eiweiss}</td>
      <td class="hide-on-small">${entry.fett}</td>
      <td><button class="delete-entry">✕</button></td>
    `;

    row.querySelector('.delete-entry').addEventListener('click', () => {
      tableBody.removeChild(row);
      gespeicherteEintraege = gespeicherteEintraege.filter(e => !eintragGleich(e, entry));
      localStorage.setItem('eintraege', JSON.stringify(gespeicherteEintraege));
      updateSumme();
    });

    tableBody.appendChild(row);
  }

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

  function truncateHistory(history) {
    const [system, ...rest] = history.messages;
    const trimmed = rest.slice(-MAX_HISTORY_LENGTH);
    return { ...history, messages: [system, ...trimmed] };
  }

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
