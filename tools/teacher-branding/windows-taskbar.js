// QCU Windows shell branding. Runs in the owning Electron main process.
// Keep the signed vendor executable and its security fuses unchanged.
if (process.platform === "win32") {
	app.setAppUserModelId("cn.qcu.assistant.teacher");
	app.on("browser-window-created", (_event, window) => {
		window.setIcon(join(process.resourcesPath, "tray.ico"));
		window.setAppDetails({
			appId: "cn.qcu.assistant.teacher",
			appIconPath: join(process.resourcesPath, "tray.ico"),
			appIconIndex: 0,
			relaunchCommand: '"' + join(process.resourcesPath, "..", "..", "QCU助手.exe") + '"',
			relaunchDisplayName: "QCU助手"
		});
	});
}
