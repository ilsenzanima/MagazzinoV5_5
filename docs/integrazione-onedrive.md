# Integrazione OneDrive aziendale per documenti di cantiere

## Contesto e motivazione

Il gestionale magazzino attualmente salva tutti i file (immagini prodotto, documenti, foto e PDF di cantiere) su un servizio di storage cloud esterno (Supabase) con spazio gratuito limitato. Le immagini degli articoli sono piccole e non rappresentano un problema. I documenti e le foto di cantiere, invece, possono essere numerosi e pesanti (PDF, certificati, fotografie), ed è qui che lo spazio disponibile rischia di diventare un vincolo.

L'obiettivo è spostare **solo questa categoria di file** (cantiere, documenti pesanti) su OneDrive aziendale, sfruttando lo spazio già incluso nell'abbonamento Microsoft 365, lasciando inalterato il resto del sito.

## Cosa serve per procedere

Per collegare il gestionale a OneDrive aziendale in modo sicuro è necessario:

1. **Registrare un'applicazione tecnica** nel tenant Microsoft 365 aziendale (Azure AD / Microsoft Entra ID). È un'operazione gratuita, non comporta costi aggiuntivi sull'abbonamento.
2. **Ottenere il consenso amministrativo** da parte di chi gestisce i permessi del tenant aziendale, per autorizzare l'app ad accedere — in lettura e scrittura — **esclusivamente a una cartella OneDrive dedicata**, non all'intero account o ad altre aree aziendali.
3. **Definire dove vivrà questa cartella**: OneDrive personale di un account aziendale dedicato, oppure (consigliato) una libreria documenti su SharePoint condivisa, più solida nel tempo perché non legata a una singola persona.

Nessun costo aggiuntivo è previsto: l'accesso ai file tramite Microsoft Graph API è incluso nei piani Microsoft 365 che già includono OneDrive/SharePoint.

## Come verrà utilizzato nel sito

Il funzionamento per chi usa il gestionale **non cambierà**: si continuerà a caricare e consultare foto/documenti di cantiere come oggi. Cambia solo dove i file vengono effettivamente salvati "dietro le quinte".

### Caricamento (upload)
- L'utente carica un file dal gestionale come fa oggi (es. foto di cantiere, PDF, certificato).
- Il file non viene più inviato direttamente dal browser al servizio di storage attuale, ma passa attraverso il server del sito, che lo trasmette in modo sicuro a Microsoft Graph API e lo salva nella cartella OneDrive dedicata (organizzata per cantiere/commessa).
- Le credenziali di accesso a OneDrive non sono mai visibili o accessibili da chi usa il sito: restano sul server.

### Consultazione/download
- Quando un utente vuole vedere o scaricare un documento, il sito richiede il file al server, che lo recupera da OneDrive tramite l'app autorizzata e lo restituisce, oppure genera un link di accesso temporaneo e limitato nel tempo.
- Nessun file in OneDrive sarà mai pubblicamente accessibile senza passare dal sito o da un link a scadenza.

### Caricamento manuale diretto su OneDrive (uso da cantiere)
- È possibile prevedere che operai/responsabili di cantiere carichino foto/documenti direttamente nella cartella OneDrive (es. tramite l'app OneDrive su telefono), seguendo una struttura di cartelle prestabilita (una cartella per cantiere/commessa).
- Il gestionale può poi rilevare automaticamente i nuovi file caricati e segnalarli per essere collegati alla commessa corretta.

## Sicurezza prevista

- **Accesso limitato per ambito (scope)**: l'app avrà permessi solo sulla cartella/libreria dedicata ai documenti di cantiere, non sull'intero tenant Microsoft 365 aziendale.
- **Nessuna esposizione di credenziali al client**: tutte le chiavi di accesso (token Azure AD) restano sul server, mai nel browser dell'utente.
- **Link di accesso temporanei**: per i documenti sensibili, l'accesso avverrà tramite link con scadenza (es. validi per un'ora), non tramite URL permanenti e pubblici.
- **Tracciabilità**: essendo un account/contesto aziendale (anziché personale), ogni accesso e modifica resta nel perimetro e nei log del tenant Microsoft 365 aziendale, consultabili dagli amministratori.
- **Revoca centralizzata**: l'amministratore del tenant può revocare in qualsiasi momento i permessi dell'app, senza bisogno di interventi sul codice del sito.
- **Separazione dei contenuti**: i documenti di cantiere resteranno isolati dalle altre informazioni e dai dati interni del gestionale, riducendo la superficie di rischio in caso di problemi su una delle due parti.

## Cosa NON cambia

- Le immagini degli articoli/prodotti restano dove sono oggi (nessun impatto, nessuna modifica necessaria).
- L'esperienza d'uso del gestionale per chi carica/consulta documenti di cantiere resta la stessa.
