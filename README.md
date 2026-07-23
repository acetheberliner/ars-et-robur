# GS Ars et Robur - Cesena

Sito ufficiale della squadra ciclistica Ars et Robur di cesena.

---
<br/>
<br/>

## 1. Come aggiornare le locandine

Le locandine delle uscite vanno inserite nella cartella:

```txt
assets/weekly/
```

Regole importanti:

- le locandine devono essere in formato ***.png***
- i nomi devono essere numerici e progressivi 
- il sito può mostrare fino a 10 locandine alla volta

Per esempio:

```txt
assets/weekly/1.png
assets/weekly/2.png
assets/weekly/3.png
...
assets/weekly/10.png
```

Per aggiornare le locandine basta sostituire i file già presenti con nuove immagini mantenendo lo stesso nome.

Per esempio, se vuoi cambiare la prima locandina, sostituisci:

```text
1.png
```

con una nuova locandina che chiamerai sempre:

```text
1.png
```

<br/>
<br/>

## 2. Come aggiugere immagini alla galleria

Le immagini della gallery vanno inserite nella cartella:

```text
assets/gallery/
```

Regole importanti:

- le immagini devono essere in formato ***.webp***
- il nome deve seguire questo formato:

```text
foto-[numero].webp
```

ad oggi sono presenti 20 foto.

Quindi, se vuoi aggiungere una nuova immagine, dovrai chiamarla:

```text
foto-21.webp
```

e poi le successive:

```text
foto-22.webp
foto-23.webp
foto-24.webp
...
```

---
<br/>
<br/>

## 3. Come aggiornare gli sponsor

Le immagini degli sponsor si trovano nella cartella

```text
assets/images/sponsor/
```

Se devi aggiungere una nuova immagine per uno sponsor, caricala in questa cartella in formato ***.png***

Regole importanti:

- Il nome del file deve essere il nome dello sponsor
- Il nome non deve contenere spazi
- Usare lettere maiuscole per ogni parola

Quindi per esempio:

```text
NomeDelloSponsor.png
```

Essendo che è impossibile prevedere quali saranno i nomi dei file dei prossimi sponsor, è richiesto un passaggio aggiuntivo.

Entrare quindi nel file chiamato:

```text
assets/images/sponsor/sponsor.json
```

Che è strutturato in questo modo:

```text
[
  { "file": "AliceBike.png", "alt": "Alice Bike" },
  { "file": "Anofor.png", "alt": "Anofor" },
  { "file": "Autolab.png", "alt": "Autolab" },
...

```

E aggiungere una nuova riga contenuta tra parentesi graffe {...} strutturata in questo modo:

```text
{"file": "NomeDelloSponsor.png", "alt": "Nome dello sponsor"}
```

(N.B.: la riga prima della nuova aggiunta richiede una virgola ',' in fondo dopo la chiusura della parentesi)

<br/>
<br/>

## 4. Come aggiornare testi/titoli/parole/...

L'unico modo per farlo è modificar l'html, tenendo presente che alcune dei contenuti non son statici (quindi presenti in chiaro nel codice html) bensi sono renderizzati in modo condizionale con funzioni inserite in js/index.js, che richiedono maggiore attenzione e comprensione.

---

## 5. Pannello di gestione contenuti

Il pannello amministrativo è disponibile all'indirizzo:

```text
https://www.gsarsetrobur-cesena.com/pageadmin/
```

La pagina non è presente nella navigazione pubblica, è esclusa dalla sitemap e contiene
le direttive `noindex`, `nofollow` e `noarchive`. La protezione effettiva è affidata
all'autenticazione GitHub: conoscere l'indirizzo non consente di modificare il sito.

Il pannello:

- converte automaticamente le fotografie della gallery in WebP;
- converte automaticamente le locandine in JPEG;
- assegna nomi univoci ai file;
- aggiorna `gallery.json` e `posters.json`;
- consente modifica, riordino ed eliminazione;
- pubblica file e JSON in un unico commit;
- blocca la pubblicazione se il branch è cambiato dopo l'apertura del pannello.

La procedura manuale descritta nelle sezioni precedenti rimane valida come fallback.

### Creazione della chiave di accesso

La chiave va creata una sola volta dall'account GitHub che gestisce la repository.

1. Accedere a GitHub.
2. Aprire `Settings` → `Developer settings` → `Personal access tokens` →
   `Fine-grained tokens`.
3. Selezionare `Generate new token`.
4. Assegnare un nome riconoscibile, ad esempio:

   ```text
   Ars et Robur Content Manager
   ```

5. Scegliere una scadenza adeguata. Alla scadenza sarà sufficiente generare una nuova
   chiave e inserirla nuovamente nel pannello.
6. In `Repository access`, scegliere `Only select repositories`.
7. Selezionare esclusivamente:

   ```text
   acetheberliner/ars-et-robur
   ```

8. In `Repository permissions`, assegnare esclusivamente:

   ```text
   Contents: Read and write
   ```

9. Lasciare tutte le altre permission su `No access`.
10. Generare e copiare la chiave. GitHub la mostra una sola volta.
11. Aprire `/pageadmin/`, incollare la chiave e scegliere se ricordarla sul dispositivo.

Non inserire mai la chiave in file della repository, commit, email o messaggi.
Se viene esposta, revocarla immediatamente dalle impostazioni GitHub.

Senza l'opzione “Ricorda su questo dispositivo”, la chiave resta soltanto nella
sessione del browser. Con l'opzione attiva viene conservata nel browser locale:
utilizzarla soltanto sul computer personale e protetto del gestore.

## 6. Pubblicazione automatica su Aruba

Il workflow `.github/workflows/deploy-aruba.yml` pubblica automaticamente su Aruba
ogni commit inviato al branch `master`, compresi quelli creati dal pannello.

Prima del primo deploy, in GitHub aprire:

```text
Settings → Secrets and variables → Actions → New repository secret
```

e creare questi tre repository secret:

```text
ARUBA_FTP_USERNAME
ARUBA_FTP_PASSWORD
ARUBA_FTP_SERVER_DIR
```

- `ARUBA_FTP_USERNAME`: account Aruba nel formato `123456@aruba.it`;
- `ARUBA_FTP_PASSWORD`: password dell'account Aruba;
- `ARUBA_FTP_SERVER_DIR`: cartella remota che contiene `index.html`, sempre con `/`
  finale. Usare `./` se, dopo l'accesso FTP, si entra direttamente nella radice del
  sito; altrimenti indicare la cartella del dominio, per esempio
  `./www.gsarsetrobur-cesena.com/`.

Il deploy usa FTPS esplicito cifrato sulla porta 21 e non esegue la pulizia completa dello
spazio web. Se nel pannello Aruba è attiva la funzione “Limita accesso FTP”, i
runner GitHub potrebbero essere bloccati perché non hanno un indirizzo IP fisso.

Il primo deploy può essere avviato manualmente da:

```text
Actions → Pubblica su Aruba → Run workflow
```
