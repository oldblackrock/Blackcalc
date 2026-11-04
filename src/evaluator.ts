// Blackcalc — calculation engine (no eval, safe recursive-descent parser)

export interface FormatOptions {
	decimals: number; // maximum fraction digits
	grouping: boolean; // thousands separator
}

export type Variables = Map<string, number>; // keys are lower-case names

// ---------- Number parsing (pt-BR: 1.250,50) ----------

const NUMBER_RE = /^(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)/;

function parseNumberToken(raw: string): number {
	let s = raw;
	if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
		// thousands with dots, decimal comma
		s = s.replace(/\./g, "").replace(",", ".");
	} else {
		s = s.replace(",", ".");
	}
	return parseFloat(s);
}

// ---------- Tokenizer ----------

type Token =
	| { t: "num"; v: number }
	| { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "%" }
	| { t: "("; v: "(" }
	| { t: ")"; v: ")" };

function tokenize(src: string): Token[] | null {
	const tokens: Token[] = [];
	let i = 0;
	const s = src.replace(/R\$/gi, " ");
	while (i < s.length) {
		const c = s[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		const rest = s.slice(i);
		const m = NUMBER_RE.exec(rest);
		if (m) {
			tokens.push({ t: "num", v: parseNumberToken(m[0]) });
			i += m[0].length;
			continue;
		}
		if (c === "+" || c === "-" || c === "^" || c === "%") {
			tokens.push({ t: "op", v: c });
		} else if (c === "*" || c === "×" || c === "·") {
			tokens.push({ t: "op", v: "*" });
		} else if (c === "/" || c === "÷" || c === ":") {
			tokens.push({ t: "op", v: "/" });
		} else if (c === "x" || c === "X") {
			// "x" as multiplication only between operands: 3 x 4, (2)x5
			const prev = tokens[tokens.length - 1];
			const prevOk = prev && (prev.t === "num" || prev.t === ")" || (prev.t === "op" && prev.v === "%"));
			const next = s.slice(i + 1).trimStart()[0];
			const nextOk = next !== undefined && /[\d(.,]/.test(next);
			if (!prevOk || !nextOk) return null;
			tokens.push({ t: "op", v: "*" });
		} else if (c === "(" || c === "[") {
			tokens.push({ t: "(", v: "(" });
		} else if (c === ")" || c === "]") {
			tokens.push({ t: ")", v: ")" });
		} else {
			return null; // unknown character -> not a calculation
		}
		i++;
	}
	return tokens;
}

// ---------- Parser ----------
// expr   := term (('+'|'-') term)*
// term   := factor (('*'|'/') factor)*
// factor := unary ('^' factor)?
// unary  := ('-'|'+') unary | postfix
// postfix:= primary '%'*
// primary:= num | '(' expr ')'

class Parser {
	private pos = 0;
	constructor(private tokens: Token[]) {}

	parse(): number | null {
		if (this.tokens.length === 0) return null;
		const v = this.expr();
		if (v === null || this.pos !== this.tokens.length) return null;
		return v;
	}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	private isOp(op: string): boolean {
		const t = this.peek();
		return !!t && t.t === "op" && t.v === op;
	}

	private expr(): number | null {
		let left = this.term();
		if (left === null) return null;
		while (this.isOp("+") || this.isOp("-")) {
			const op = (this.tokens[this.pos++] as { v: string }).v;
			// "200 + 10%" => 220 (percentage of the left side, like a calculator)
			const save = this.pos;
			const pct = this.tryPercentTerm();
			let right: number | null;
			if (pct !== null) {
				right = left * pct;
			} else {
				this.pos = save;
				right = this.term();
			}
			if (right === null) return null;
			left = op === "+" ? left + right : left - right;
		}
		return left;
	}

	// matches a lone "N%" term followed by + - ) or end
	private tryPercentTerm(): number | null {
		const a = this.tokens[this.pos];
		const b = this.tokens[this.pos + 1];
		const c = this.tokens[this.pos + 2];
		if (a?.t === "num" && b?.t === "op" && b.v === "%") {
			const endOk = !c || c.t === ")" || (c.t === "op" && (c.v === "+" || c.v === "-"));
			if (endOk) {
				this.pos += 2;
				return a.v / 100;
			}
		}
		return null;
	}

	private term(): number | null {
		let left = this.factor();
		if (left === null) return null;
		while (this.isOp("*") || this.isOp("/")) {
			const op = (this.tokens[this.pos++] as { v: string }).v;
			const right = this.factor();
			if (right === null) return null;
			left = op === "*" ? left * right : left / right;
		}
		return left;
	}

	private factor(): number | null {
		const base = this.unary();
		if (base === null) return null;
		if (this.isOp("^")) {
			this.pos++;
			const exp = this.factor();
			if (exp === null) return null;
			return Math.pow(base, exp);
		}
		return base;
	}

	private unary(): number | null {
		if (this.isOp("-")) {
			this.pos++;
			const v = this.unary();
			return v === null ? null : -v;
		}
		if (this.isOp("+")) {
			this.pos++;
			return this.unary();
		}
		return this.postfix();
	}

	private postfix(): number | null {
		let v = this.primary();
		if (v === null) return null;
		while (this.isOp("%")) {
			this.pos++;
			v = v / 100;
		}
		return v;
	}

	private primary(): number | null {
		const t = this.peek();
		if (!t) return null;
		if (t.t === "num") {
			this.pos++;
			return t.v;
		}
		if (t.t === "(") {
			this.pos++;
			const v = this.expr();
			if (v === null) return null;
			const close = this.peek();
			if (!close || close.t !== ")") return null;
			this.pos++;
			return v;
		}
		return null;
	}
}

// ---------- Variables ----------

const NAME_CHARS = "A-Za-zÀ-ÖØ-öø-ÿ_";
const NAME_RE = new RegExp(`^[${NAME_CHARS}][${NAME_CHARS}0-9 ]*$`);

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isValidName(name: string): boolean {
	const n = name.trim();
	if (!NAME_RE.test(n)) return false;
	// "x" alone would clash with the multiplication sign
	return n.toLowerCase() !== "x";
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces known variable names (longest first) by their values. */
function substitute(expr: string, vars: Variables): { text: string; used: boolean } {
	if (vars.size === 0) return { text: expr, used: false };
	const names = [...vars.keys()].sort((a, b) => b.length - a.length);
	let text = expr;
	let used = false;
	for (const name of names) {
		const pattern = escapeRe(name).replace(/ /g, "\\s+");
		const re = new RegExp(`(?<![${NAME_CHARS}0-9])${pattern}(?![${NAME_CHARS}0-9])`, "gi");
		text = text.replace(re, () => {
			used = true;
			const v = vars.get(name)!;
			// plain JS number written with comma decimal so the tokenizer reads it
			return `(${String(v).replace(".", ",")})`;
		});
	}
	return { text, used };
}

/** Evaluates an expression. Returns null when it isn't a valid calculation. */
export function evaluate(expr: string, vars: Variables): number | null {
	const { text } = substitute(expr, vars);
	const tokens = tokenize(text);
	if (!tokens) return null;
	const v = new Parser(tokens).parse();
	if (v === null || !Number.isFinite(v)) return null;
	return v;
}

// ---------- Line analysis ----------

const PREFIX_RE = /^\s*(?:>\s*)*(?:[-*+]\s+(?:\[.\]\s+)?|\d+[.)]\s+)?/;

export interface LineResult {
	kind: "pending" | "assignment" | "none";
	value?: number;
	name?: string;
}

function hasOperator(expr: string): boolean {
	return /[+\-*/×÷^%·]|\s[xX]\s|\d[xX]\d/.test(expr);
}

/**
 * Picks the calculation part of a line: the whole line, or what comes after
 * the last ":" if the line has a label ("Total: 10+50=").
 */
function candidates(body: string): string[] {
	const list = [body];
	const colon = body.lastIndexOf(":");
	if (colon !== -1) list.push(body.slice(colon + 1));
	return list;
}

export function analyzeLine(line: string, vars: Variables): LineResult {
	const prefix = PREFIX_RE.exec(line)?.[0] ?? "";
	const body = line.slice(prefix.length);

	// Pending calculation: ends with "=" (and not "==" / "<=" / ">=" / "!=")
	const trimmed = body.replace(/\s+$/, "");
	if (trimmed.endsWith("=") && !/[=<>!]=$/.test(trimmed)) {
		const exprFull = trimmed.slice(0, -1);
		// "Total = Abacaxi + Banana =" -> also defines Total
		const assign = /^([^=]+?)=([^=]+)$/.exec(exprFull);
		if (assign && isValidName(assign[1])) {
			const v = evaluate(assign[2], vars);
			if (v !== null) return { kind: "pending", value: v, name: normalizeName(assign[1]) };
		}
		if (exprFull.includes("=")) return { kind: "none" };
		for (const cand of candidates(exprFull)) {
			if (!cand.trim()) continue;
			const { used } = substitute(cand, vars);
			if (!used && !hasOperator(cand)) continue; // "10=" alone is not a calculation
			const v = evaluate(cand, vars);
			if (v !== null) return { kind: "pending", value: v };
		}
		return { kind: "none" };
	}

	// Assignment: "Abacaxi = 50" or "Total = Abacaxi + Banana = 110"
	const parts = body.split("=");
	if (parts.length >= 2 && isValidName(parts[0])) {
		const name = normalizeName(parts[0]);
		// with an accepted result, the last part is the value; otherwise the expression
		const exprPart = parts.length >= 3 ? parts[parts.length - 1] : parts[1];
		let v = evaluate(exprPart, vars);
		if (v === null && parts.length >= 3) v = evaluate(parts[1], vars);
		if (v !== null) return { kind: "assignment", value: v, name };
	}
	return { kind: "none" };
}

// ---------- Formatting ----------

export function formatNumber(v: number, opts: FormatOptions): string {
	// avoid -0 and float noise like 0.1+0.2
	const rounded = Number(v.toFixed(Math.min(Math.max(opts.decimals, 0), 12)));
	return new Intl.NumberFormat("pt-BR", {
		maximumFractionDigits: Math.min(Math.max(opts.decimals, 0), 12),
		minimumFractionDigits: 0,
		useGrouping: opts.grouping,
	}).format(Object.is(rounded, -0) ? 0 : rounded);
}

// ---------- Document scan ----------

export interface PendingLine {
	lineNumber: number; // 1-based, CodeMirror style
	value: number;
}

/**
 * Walks a note top-down, collecting variables and lines waiting for a result.
 * Lines inside fenced code blocks and frontmatter are ignored.
 */
export function scanDocument(lines: string[]): { pending: Map<number, number>; vars: Variables } {
	const vars: Variables = new Map();
	const pending = new Map<number, number>();
	let inFence = false;
	let fenceMarker = "";
	let inFrontmatter = lines[0]?.trim() === "---";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (inFrontmatter) {
			if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) inFrontmatter = false;
			continue;
		}
		const fence = /^\s*(`{3,}|~{3,})/.exec(line);
		if (fence) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fence[1][0];
			} else if (fence[1][0] === fenceMarker) {
				inFence = false;
			}
			continue;
		}
		if (inFence || !line.includes("=")) continue;

		const r = analyzeLine(line, vars);
		if (r.kind === "pending" && r.value !== undefined) {
			pending.set(i + 1, r.value);
			if (r.name) vars.set(r.name, r.value);
		} else if (r.kind === "assignment" && r.name && r.value !== undefined) {
			vars.set(r.name, r.value);
		}
	}
	return { pending, vars };
}
