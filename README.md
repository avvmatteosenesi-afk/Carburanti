# Carburanti

PWA mobile-first per consultare i prezzi dei carburanti comunicati al MIMIT.

## Funzioni

- Benzina, Gasolio, GPL e Metano; nessuna funzione di ricarica elettrica.
- Toscana: province, zone rapide, Tutta la Toscana, Posizione attuale e modalità Libera.
- Posizione attuale: zoom 13, marker entro 10 km; minimo e fasce di convenienza calcolati entro 30 km.
- Colori: verde minimo, verde chiaro entro 1 cent, giallo entro 3 cent, bianco per gli altri.
- Preferenze persistenti per carburante e zona di apertura.
- Modalità Viaggio nazionale con percorso blu, distanza, durata e miglior prezzo.
- Se il percorso è significativamente autostradale, vengono mostrati solo impianti/aree di servizio autostradali lungo il corridoio del percorso.
- Aggiornamento automatico dei dati MIMIT due volte al giorno e deploy GitHub Pages.
- Controllo provincia↔coordinate per eliminare impianti toscani con coordinate manifestamente incompatibili con la provincia dichiarata.

## Fonte dati

Open data MIMIT: anagrafica degli impianti attivi e prezzi alle 8. Dal 10 febbraio 2026 il delimitatore dei CSV è `|`.

## Deploy

Il workflow `.github/workflows/update-and-deploy.yml` aggiorna i dataset e pubblica il repository su GitHub Pages.
