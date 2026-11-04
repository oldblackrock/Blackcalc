# Blackcalc

Inline math in your Obsidian notes, like Apple Notes.

Type an expression ending with `=` and Blackcalc shows the result as a gray suggestion. Press **Tab** to insert it. Don't want it? Just keep typing — your own text wins.

```
10 + 50 =            → 60

Abacaxi = 50
Banana = 60
Abacaxi + Banana =   → 110

Total = Abacaxi * 3 = → 150   (also defines Total)
Total / 2 =          → 75
```

## Features

- **Gray suggestion + Tab** — nothing is written to your note until you accept it.
- **Variables** — `Name = value` or `Name = expression`. Names are case-insensitive, may contain accents and spaces (`Custo total = 1.000`). Variables are per note and read top-down.
- **Brazilian number format** — `1.250,50` reads as one thousand two hundred fifty and fifty cents. Results use the same format.
- **Operators** — `+ - * / ^ ( )`, plus `x`, `×`, `÷`, `:` and `%` (`200 + 10% = 220`, `200 * 10% = 20`). `R$` is ignored.
- **Works with lists, checkboxes and labels** — `- 10 + 5 =`, `- [ ] 2*3 =`, `Total: 10 + 50 =`.
- **Ignored**: code blocks, frontmatter, comparisons (`==`, `<=`, `>=`), a lone number (`10 =`), text values (`Status = pending`).

## Commands

- **Insert result on current line**
- **Insert all results in this note**
- **Toggle calculations**

## Settings

Enable/disable, maximum decimal places (default 2), thousands separator, Tab hint badge, accept with Enter.

## Installation

### Manual
1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Copy them to `<your vault>/.obsidian/plugins/blackcalc/`.
3. In Obsidian: Settings → Community plugins → enable **Blackcalc**.

### From source
```bash
npm install
npm run build   # creates main.js
npm test        # runs the calculation tests
```

## License

MIT
