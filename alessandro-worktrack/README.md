# WorkTrack — Alessandro

PWA mobile-first per tenere traccia di lavori a chiamata, turni, ore, paghe reali e stime future. È pensata per essere aggiunta alla schermata Home di iPhone e usata come una normale app.

## Funzioni incluse

- Dashboard mensile con guadagnato reale, proiezione, confronto col mese precedente, ore lavorate, media oraria e soldi ancora da incassare.
- Calendario mensile dei turni con riepilogo economico per giorno.
- Lavori completamente modificabili: paga oraria, paga fissa, paga variabile, ore tipiche, rapporto continuativo o a periodo fisso, colore, stato attivo.
- Turni completamente modificabili e indipendenti dal lavoro base: ore stimate/reali, paga oraria/fissa custom, totale manuale, bonus, mance, trattenute, stato programmato/completato/annullato e pagato/non pagato.
- Previsioni future separate dai guadagni già realizzati.
- Analytics degli ultimi 6 mesi e rendimento per lavoro.
- Backup/import JSON.
- Persistenza server su file JSON atomico + cache locale iPhone.
- PIN opzionale tramite variabile `APP_PIN`.
- PWA installabile, service worker, icona Home, safe-area iPhone.
- Blocco dello scroll del documento: scorre solo il contenuto interno dell'app, riducendo drasticamente rubber-band e movimento tipico di Safari/PWA.

## Avvio locale

Richiede Node.js 20+.

```bash
npm install
npm run build
APP_PIN=1234 npm start
```

Poi apri `http://localhost:3000`.

Per sviluppo frontend puoi usare `npm run dev`; in quel caso il backend deve essere avviato separatamente su porta 3000.

## Deploy su Railway

1. Crea un repository GitHub e carica l'intera cartella.
2. Su Railway: **New Project → Deploy from GitHub Repo** e seleziona il repository.
3. Nelle Variables aggiungi:
   - `APP_PIN`: un PIN privato a tua scelta, per esempio `4827`.
   - `DATA_DIR`: `/data`.
4. Nel servizio Railway aggiungi un **Volume persistente** e montalo su `/data`.
5. Fai deploy. Railway userà `railway.json`, eseguirà `npm install && npm run build` e poi `npm start`.
6. Apri il dominio HTTPS generato da Railway.

### Importante sulla persistenza

Il volume `/data` è fondamentale. Senza volume, Railway può ricreare il filesystem durante un redeploy e il database server potrebbe andare perso. L'app mantiene comunque una cache locale sul singolo iPhone, ma il volume è la sorgente persistente corretta.

## Installazione su iPhone 16

1. Apri l'URL Railway in **Safari**.
2. Tocca **Condividi**.
3. Tocca **Aggiungi alla schermata Home**.
4. Avvia WorkTrack dall'icona appena creata.

La PWA usa `display: standalone`, `viewport-fit=cover`, safe-area, `100dvh`, body `position: fixed` e `overflow: hidden`. Il documento Safari non scorre: si muovono solo i contenitori interni esplicitamente scrollabili. Questo evita l'effetto “pagina web che galleggia/rimbalza” quando la usi dalla Home.

## Backup

Dall'app: **Altro → Esporta JSON**. Conserva periodicamente quel file. Per ripristinare, usa **Importa backup**.

## Struttura

```text
src/                 React UI e logica
server/              API Express + persistenza
public/              manifest, service worker, icone
railway.json         configurazione Railway
.env.example         variabili esempio
```

## Sicurezza

Imposta sempre `APP_PIN` se il dominio Railway è pubblico. Il PIN genera una sessione HTTP-only. Il progetto è pensato come single-user personale, non come piattaforma multi-account.
