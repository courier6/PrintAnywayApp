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
| French | fr | vous; no-break space (U+00A0) before ? ! : ; | « » with no-break spaces inside |
| German | de | Sie; spaced en dash – instead of — | „ “ |
| Italian | it | tu | « » |
| Japanese | ja | です/ます (polite); full-width punctuation (、。？！：); no spaces between words; plural keys: `.other` only | 「 」 |
| Russian | ru | вы (lowercase); plural keys: `.one`, `.few`, `.many`, `.other` | « » |
| Chinese (Simplified) | zh-CN | 你; full-width punctuation (，。？！：); —— for a dash; space between Chinese and Latin text or numbers; plural keys: `.other` only | “ ” |

## Terms

`{ink}` is filled with the capitalized swatch name, so place it where capitals read naturally (e.g. after a colon).

| English | es | pt-BR | fr | de | it | ja | ru | zh-CN |
|---|---|---|---|---|---|---|---|---|
| black ink | tinta negra | tinta preta | encre noire | schwarze Tinte | inchiostro nero | 黒インク | чёрные чернила | 黑色墨水 |
| cartridge | cartucho | cartucho | cartouche | Patrone | cartuccia | カートリッジ | картридж | 墨盒 |
| recolor | recolorear | recolorir | recolorer | umfärben | ricolorare | 色変換（する） | перекрашивать | 重新着色 |
| Epson / Canon stop button | Detener/Cancelar (Stop/Cancel), Parar (Stop) | Parar/Cancelar (Stop/Cancel), Parar (Stop) | Arrêt/Annuler (Stop/Cancel), Arrêt (Stop) | Stopp/Abbrechen (Stop/Cancel), Stopp (Stop) | Stop/Annulla (Stop/Cancel), Stop | ストップ/キャンセル（Stop/Cancel）、ストップ（Stop） | Стоп/Отмена (Stop/Cancel), Стоп (Stop) | 停止/取消（Stop/Cancel）、停止（Stop） |
| print dialog | ventana de impresión | janela de impressão | fenêtre d’impression | Druckdialog | finestra di stampa | 印刷ダイアログ | окно печати | 打印对话框 |
| grayscale | escala de grises | tons de cinza | niveaux de gris | Graustufen | scala di grigi | グレースケール | оттенки серого | 灰度 |
| black & white | blanco y negro | preto e branco | noir et blanc | Schwarzweiß | bianco e nero | 白黒 | чёрно-белый | 黑白 |
| Keyboard Enter key | Enter | Enter | Entrée | Eingabetaste | Invio | Enter | Enter | Enter |
| Color (print dialog option) | Color | Colorido | Couleur | Farbe | Colore | カラー | Цветной | 彩色 |
| Print → Save as PDF | Imprimir → Guardar como PDF | Imprimir → Salvar como PDF | Imprimer → Enregistrer au format PDF | Drucken → Als PDF speichern | Stampa → Salva come PDF | 印刷 → PDFとして保存 | Печать → Сохранить как PDF | 打印 → 另存为 PDF |
| Dark navy | Azul marino | Azul-marinho | Bleu marine | Marineblau | Blu notte | 濃紺 | Тёмно-синий | 藏青色 |
| Dark teal | Verde petróleo | Verde-petróleo | Bleu canard | Petrolblau | Verde petrolio | 濃い青緑 | Тёмно-бирюзовый | 深青色 |
| Dark maroon | Granate | Bordô | Bordeaux | Weinrot | Bordeaux | えんじ色 | Бордовый | 深酒红色 |
| Dark purple | Morado oscuro | Roxo escuro | Violet foncé | Dunkelviolett | Viola scuro | 濃い紫 | Тёмно-фиолетовый | 深紫色 |

## Process (per language)

1. Translate `en.properties` into `<code>.properties` using this glossary.
2. A fresh agent that has not seen `en.properties` back-translates the file to English; compare with `en.properties` and fix any change in meaning.
3. Flag strings more than 40% longer than the English and check the layout at 360 px.
4. Edgar spot-checks the landing copy and meta description, then the error messages.
