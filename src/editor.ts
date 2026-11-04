import { EditorState, Prec, RangeSetBuilder, StateEffect, StateField, Text, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType, keymap } from "@codemirror/view";
import { BlackcalcSettings } from "./settings";
import { formatNumber, scanDocument } from "./evaluator";

/** Dispatched when settings change so every open editor recomputes. */
export const refreshEffect = StateEffect.define<null>();

interface CalcState {
	pending: Map<number, number>; // line number -> value
	deco: DecorationSet;
}

class GhostWidget extends WidgetType {
	constructor(readonly text: string, readonly hint: boolean) {
		super();
	}
	eq(other: GhostWidget): boolean {
		return other.text === this.text && other.hint === this.hint;
	}
	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "blackcalc-ghost";
		span.textContent = this.text;
		if (this.hint) {
			const k = document.createElement("span");
			k.className = "blackcalc-hint";
			k.textContent = "Tab";
			span.appendChild(k);
		}
		span.setAttribute("aria-label", `Result: ${this.text}`);
		return span;
	}
	ignoreEvent(): boolean {
		return false;
	}
}

function docLines(doc: Text): string[] {
	const out: string[] = [];
	for (let i = 1; i <= doc.lines; i++) out.push(doc.line(i).text);
	return out;
}

/** Text to insert: mirrors the spacing used before "=" ("10 + 50 =" -> " 60"). */
export function insertionText(lineText: string, formatted: string): { text: string; trimEnd: number } {
	const trailing = /\s*$/.exec(lineText)?.[0].length ?? 0;
	const core = lineText.slice(0, lineText.length - trailing);
	const spaced = /\s=$/.test(core);
	return { text: (spaced ? " " : "") + formatted, trimEnd: trailing };
}

export function buildCalcExtension(getSettings: () => BlackcalcSettings) {
	const compute = (state: EditorState): CalcState => {
		const settings = getSettings();
		const builder = new RangeSetBuilder<Decoration>();
		if (!settings.enabled) return { pending: new Map(), deco: builder.finish() };

		const { pending } = scanDocument(docLines(state.doc));
		const cursorLine = state.doc.lineAt(state.selection.main.head).number;
		const lineNos = [...pending.keys()].sort((a, b) => a - b);
		for (const n of lineNos) {
			const line = state.doc.line(n);
			const value = formatNumber(pending.get(n)!, settings);
			const { text } = insertionText(line.text, value);
			const showHint = settings.showTabHint && n === cursorLine;
			builder.add(
				line.to,
				line.to,
				Decoration.widget({ widget: new GhostWidget(text, showHint), side: 1 })
			);
		}
		return { pending, deco: builder.finish() };
	};

	const field = StateField.define<CalcState>({
		create: (state) => compute(state),
		update(value, tr: Transaction) {
			const refresh = tr.effects.some((e) => e.is(refreshEffect));
			if (tr.docChanged || refresh || (tr.selection && getSettings().showTabHint)) {
				return compute(tr.state);
			}
			return value;
		},
		provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
	});

	/** Inserts the result on the cursor's line. Returns false when there is nothing to accept. */
	const acceptAtCursor = (view: EditorView, requireLineEnd: boolean): boolean => {
		const settings = getSettings();
		if (!settings.enabled) return false;
		const sel = view.state.selection.main;
		if (!sel.empty) return false;
		const line = view.state.doc.lineAt(sel.head);
		const calc = view.state.field(field, false);
		const value = calc?.pending.get(line.number);
		if (value === undefined) return false;

		const { text, trimEnd } = insertionText(line.text, formatNumber(value, settings));
		const insertAt = line.to - trimEnd;
		if (requireLineEnd && sel.head < insertAt) return false;

		view.dispatch({
			changes: { from: insertAt, to: line.to, insert: text },
			selection: { anchor: insertAt + text.length },
			userEvent: "input.blackcalc",
			scrollIntoView: true,
		});
		return true;
	};

	const keys = Prec.highest(
		keymap.of([
			{ key: "Tab", run: (view) => acceptAtCursor(view, true) },
			{
				key: "Enter",
				run: (view) => {
					if (!getSettings().acceptWithEnter) return false;
					acceptAtCursor(view, true);
					return false; // let the normal Enter create the new line
				},
			},
		])
	);

	return { extension: [field, keys], field, acceptAtCursor };
}

/** Inserts every pending result in the note (bottom-up so positions stay valid). */
export function acceptAll(view: EditorView, field: StateField<CalcState>, settings: BlackcalcSettings): number {
	const calc = view.state.field(field, false);
	if (!calc || calc.pending.size === 0) return 0;
	const changes = [...calc.pending.entries()].map(([n, v]) => {
		const line = view.state.doc.line(n);
		const { text, trimEnd } = insertionText(line.text, formatNumber(v, settings));
		return { from: line.to - trimEnd, to: line.to, insert: text };
	});
	view.dispatch({ changes, userEvent: "input.blackcalc" });
	return changes.length;
}
