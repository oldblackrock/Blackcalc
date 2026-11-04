import { App, PluginSettingTab, Setting } from "obsidian";
import type BlackcalcPlugin from "./main";

export interface BlackcalcSettings {
	enabled: boolean;
	decimals: number;
	grouping: boolean;
	showTabHint: boolean;
	acceptWithEnter: boolean;
}

export const DEFAULT_SETTINGS: BlackcalcSettings = {
	enabled: true,
	decimals: 2,
	grouping: true,
	showTabHint: true,
	acceptWithEnter: false,
};

export class BlackcalcSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: BlackcalcPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable calculations")
			.setDesc('Show the result as a gray suggestion when a line ends with "=". Press Tab to insert it.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enabled).onChange(async (v) => {
					this.plugin.settings.enabled = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Maximum decimal places")
			.setDesc("Results are rounded to this many decimals (trailing zeros are hidden).")
			.addSlider((s) =>
				s
					.setLimits(0, 10, 1)
					.setValue(this.plugin.settings.decimals)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.decimals = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Thousands separator")
			.setDesc("Show results as 1.250,50 instead of 1250,50.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.grouping).onChange(async (v) => {
					this.plugin.settings.grouping = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Show Tab hint")
			.setDesc("Show a small Tab badge next to the suggestion on the line you are editing.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showTabHint).onChange(async (v) => {
					this.plugin.settings.showTabHint = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Accept with Enter")
			.setDesc("Also insert the result when you press Enter at the end of the line.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.acceptWithEnter).onChange(async (v) => {
					this.plugin.settings.acceptWithEnter = v;
					await this.plugin.saveSettings();
				})
			);
	}
}
