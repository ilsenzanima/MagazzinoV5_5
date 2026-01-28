---
description: Verifica il progetto con la build e carica le modifiche su GitHub
---

1. Esegui la build per assicurarti che non ci siano errori.
   - Command: `npm run build`
   
2. Se la build ha successo (exit code 0), procedi con il commit e push.
   - Command: `git add .`
   - Command: `git commit -m "update: changes verified by build"` (Chiedi all'utente se vuole un messaggio specifico prima di eseguire, se non specificato usa questo)
   - Command: `git push`

3. Notifica l'utente che le modifiche sono online.
