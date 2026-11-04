import { MarkdownView, Notice, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import { BlackcalcSettingTab, BlackcalcSettings, DEFAULT_SETTINGS } from "./settings";
import { acceptAll, buildCalcExtension, refreshEffect } from "./editor";

export default class BlackcalcPlugin extends Plugin {
	settings: BlackcalcSettings = { ...DEFAULT_SETTINGS };
	private calc!: ReturnType<typeof buildCalcExtension>;

	async onload() {
		await this.loadSettings();

		this.calc = buildCalcExtension(() => this.settings);
		this.registerEditorExtension(this.calc.extension);

		this.addCommand({
			id: "insert-result",
			name: "Insert result on current line",
			editorCallback: (_editor, ctx) => {
				const view = this.cmView(ctx);
				if (!view || !this.calc.acceptAtCursor(view, false)) {
					new Notice("Blackcalc: no calculation on this line.");
				}
			},
		});

		this.addCommand({
			id: "insert-all-results",
			name: "Insert all results in this note",
			editorCallback: (_editor, ctx) => {
				const view = this.cmView(ctx);
				const n = view ? acceptAll(view, this.calc.field, this.settings) : 0;
				new Notice(n ? `Blackcalc: ${n} result(s) inserted.` : "Blackcalc: nothing to insert.");
			},
		});

		this.addCommand({
			id: "toggle",
			name: "Toggle calculations",
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				new Notice(`Blackcalc ${this.settings.enabled ? "on" : "off"}`);
			},
		});

		this.addSettingTab(new BlackcalcSettingTab(this.app, this));
	}

	private cmView(ctx: unknown): EditorView | null {
		const editor = (ctx as MarkdownView)?.editor as unknown as { cm?: EditorView } | undefined;
		return editor?.cm ?? null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshEditors();
	}

	private refreshEditors() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
				cm?.dispatch({ effects: refreshEffect.of(null) });
			}
		});
	}
}
