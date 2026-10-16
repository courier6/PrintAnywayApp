# Translation glossary

Rules for every `<code>.properties` file. `en.properties` is the source; translations keep its keys, order, section comments and `{placeholders}` exactly (the build checks keys and placeholders).

## Never translate

- `PrintAnyway App`
- `PDF`, `PNG`, `JPG`, `HEIC`
- Printer brands: HP, Epson, Canon, and the app name "HP Smart"

## Tone

Plain, short and friendly. People arrive frustrated by a printer that won't print, so get them to the fix fast. Match the English sentence count; don't add explanations.

| Language | Code | Address the reader as | Quotes |
|---|---|---|---|
| Spanish | es | tú; Latin-American-neutral verbs (presiona, Enter) | “ ” |
| Portuguese (Brazil) | pt-BR | você | “ ” |
| French | fr | vous | « » with no-break spaces inside |
| German | de | Sie | „ “ |

## Terms

`{ink}` is filled with the capitalized swatch name, so place it where capitals read naturally (e.g. after a colon).

| English | es | pt-BR | fr | de |
|---|---|---|---|---|
| black ink | tinta negra | tinta preta | encre noire | schwarze Tinte |
| cartridge | cartucho | cartucho | cartouche | Patrone |
| re-ink / recolor | recolorear | recolorir | recolorer | umfärben |
| print dialog | ventana de impresión | janela de impressão | fenêtre d’impression | Druckdialog |
| grayscale | escala de grises | escala de cinza | niveaux de gris | Graustufen |
| black & white | blanco y negro | preto e branco | noir et blanc | Schwarzweiß |
| Color (print dialog option) | Color | Colorido | Couleur | Farbe |
| Print → Save as PDF | Imprimir → Guardar como PDF | Imprimir → Salvar como PDF | Imprimer → Enregistrer au format PDF | Drucken → Als PDF speichern |
| Dark navy | Azul marino | Azul-marinho escuro | Bleu marine foncé | Dunkles Marineblau |
| Dark teal | Verde petróleo | Verde-azulado escuro | Bleu canard foncé | Dunkles Petrol |
| Dark maroon | Granate | Bordô escuro | Bordeaux foncé | Dunkles Weinrot |
| Dark purple | Morado oscuro | Roxo escuro | Violet foncé | Dunkles Violett |

## Process (per language)

1. Translate `en.properties` into `<code>.properties` using this glossary.
2. A fresh agent that has not seen `en.properties` back-translates the file to English; compare with `en.properties` and fix any change in meaning.
3. Flag strings more than 40% longer than the English and check the layout at 360 px.
4. Edgar spot-checks the landing copy and meta description, then the error messages.
