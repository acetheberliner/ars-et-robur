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