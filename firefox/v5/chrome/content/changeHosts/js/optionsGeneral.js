/**
 * Options overlay functions - General Tab
 *
 * @author marcotulio
 */
(function(){

	Components.utils.import("chrome://changeHosts/content/js/ctech/logUtils.jsm");

	coders.ns("coders.changeHosts.options").general = {

		ctx: coders.changeHosts.applicationContext,
		logger: Log.repository.getLogger("coders.changeHosts.options.general"),

		optionsDefinitions: coders.changeHosts.options.definitions,
		hostMap: {},
		hostFileNamePattern: null,
		hostCount: 0,
		hostDirToSelect: null,
		hostNameToSelect: null,

		onLoad: function() {
			if (this.ctx.dnsFlusher.integrated()) {
				this.ctx.browserUtils.getElement("dnsFlusherIntegrationDisclaimerMiss").setAttribute("style", "display:none");
				this.ctx.browserUtils.getElement("dnsFlusherIntegrationDisclaimerFound").setAttribute("style", "display:block");
				this.ctx.browserUtils.getElement("flushDNSOnChangeCheckbox").disabled = false;
			}

			this.handleMigration();

			this.buildRegexList();
		},

		onUnload: function() {

		},

		handleMigration: function() {
			var openDialog = this.ctx.preferenceUtils.getBool("open-migration-dialog");
			if (openDialog) {
				var msg = this.ctx.preferenceUtils.getSBundle().getString("cH.oldVersionDisclaimer");
				var result = this.ctx.browserUtils.showPrompt("Change Hosts", msg, "Continue");
				if (result == 0){
					this.ctx.preferenceUtils.clear("open-migration-dialog");
				}
			}
		},

		rootDirSelected: function() {
			this.checkDefinitionsRootDirPermission();
			this.reloadTree();
		},

		pickHostFile: function() {
			var fp = this.ctx.fileUtils.getFilePicker();
			const nsIFilePicker = Components.interfaces.nsIFilePicker;
			fp.appendFilters(nsIFilePicker.filterAll);

			fp.init(window, this.ctx.preferenceUtils.getSBundle().getString("cH.pickHostFile"), nsIFilePicker.modeOpen);
			var value = fp.show();
			if (value == nsIFilePicker.returnOK) {
				var textbox = this.ctx.browserUtils.getElement("hosts-location");
				textbox.value = fp.file.path;
				this.ctx.browserUtils.getElement('prefpane_general').userChangedValue(textbox);
				this.checkHostPermission();
			}
		},

		pickDefinitionsRootDir: function() {
			var fp = this.ctx.fileUtils.getFilePicker();
			const nsIFilePicker = Components.interfaces.nsIFilePicker;
			fp.appendFilters(nsIFilePicker.filterAll);

			fp.init(window, this.ctx.preferenceUtils.getSBundle().getString("cH.pickRootFolder"), nsIFilePicker.modeGetFolder);
			var value = fp.show();
			if (value == nsIFilePicker.returnOK) {
				var textbox = this.ctx.browserUtils.getElement("definitions-root-dir");
				textbox.value = fp.file.path;
				this.ctx.browserUtils.getElement('prefpane_general').userChangedValue(textbox);
				this.rootDirSelected();
			}
		},

		pickScript: function() {
			var fp = this.ctx.fileUtils.getFilePicker();
			const nsIFilePicker = Components.interfaces.nsIFilePicker;
			fp.appendFilters(nsIFilePicker.filterAll);

			fp.init(window, this.ctx.preferenceUtils.getSBundle().getString("cH.pickScriptFile"), nsIFilePicker.modeOpen);
			var value = fp.show();
			if (value == nsIFilePicker.returnOK) {
				var textbox = this.ctx.browserUtils.getElement("script-location");
				textbox.value = fp.file.path;
				this.ctx.browserUtils.getElement('prefpane_general').userChangedValue(textbox);
				this.checkScriptPermission();
			}
		},

		checkPermissions: function() {
			this.checkHostPermission();
			this.checkScriptPermission();
			this.checkDefinitionsRootDirPermission();
		},

		checkScriptPermission: function() {
			var filePath = this.ctx.browserUtils.getElement("script-location").value;
			var file = this.ctx.fileUtils.getFile(filePath);
			if (file && file.exists() && !this.ctx.browserUtils.isMacOS()) {
				if (file.isFile()) {
					this.setPermissionResult("testRunFile", file.isExecutable());
				} else {
					this.setPermissionResult("testRunFile", false);
				}
			} else {
				this.setPermissionResult("testRunFile", null);
			}
		},

		checkHostPermission: function() {
			var filePath = this.getHostsLocationPath();
			var file = this.ctx.fileUtils.getFile(filePath);
			if (file && file.exists() && file.isFile()) {
				this.setPermissionResult("testReadFile", file.isReadable());
				this.setPermissionResult("testWriteFile", file.isWritable());
			} else {
				this.logger.debug("File " + filePath + " is not a file, testing if directoy is writable...")
				var io = filePath.lastIndexOf(this.ctx.fileUtils.getFileSeparator());
				var dirPath = filePath.substring(0, io + 1);
				this.logger.debug("Testing directory: " + dirPath);
				var dir = this.ctx.fileUtils.getFile(dirPath);
				if (dir && dir.exists() && dir.isDirectory) {
					this.setPermissionResult("testReadFile", dir.isReadable());
					this.setPermissionResult("testWriteFile", dir.isWritable());
				} else {
					this.setPermissionResult("testReadFile", false);
					this.setPermissionResult("testWriteFile", false);
				}
			}
		},

		checkDefinitionsRootDirPermission: function() {
			var filePath = this.ctx.browserUtils.getElement("definitions-root-dir").value;
			var file = this.ctx.fileUtils.getFile(filePath);
			if (file && file.exists() && file.isDirectory()) {
				this.setPermissionResult("testRootDir", file.isReadable());
			} else {
				this.setPermissionResult("testRootDir", false);
			}
		},

		setPermissionResult: function(elementId, result) {
			var element = this.ctx.browserUtils.getElement(elementId);
			if (result != null && result != undefined) {
				if (result) {
					element.setAttribute("class", "testImgOK");
				} else {
					element.setAttribute("class", "testImgFail");
				}
			} else {
				element.setAttribute("class", "testImgQuestion");
			}

		},

		executeScript: function() {
			var filePath = this.ctx.browserUtils.getElement("script-location").value;

			if (filePath.trim() == "") {
				alert(this.ctx.preferenceUtils.getSBundle().getString("cH.youShouldSelectAScriptToExecute"));
				return;
			}
			try {
				var sudo = this.ctx.browserUtils.getElement("script-sudo-flag").checked;
				this.ctx.fileUtils.execute(filePath, sudo);
			} catch (ex) {
				this.logger.error("Error running file: " + filePath + " Stack: " + ex);
				alert(this.ctx.preferenceUtils.getSBundle().getString("cH.errorRunningFile") + ex);
			}
		},

		getHostsLocationPath: function() {
			return this.ctx.browserUtils.getElement('hosts-location').value;
		},

		defaultColorChanged: function() {
			this.ctx.uiManager.setCurrentColor();
			this.reloadTree();
		},

		showHideViewElements: function(element, show) {
			var browserWindow = this.ctx.browserUtils.getBrowserWindow();
			this.ctx.browserUtils.getElement(element, browserWindow.document).hidden = !show;
		},

		scriptPermissionToggleCheck: function() {
			this.scriptPermissionToggle(this.ctx.browserUtils.getElement("script-flag").checked);
		},

		scriptPermissionToggle: function(value) {
			this.ctx.browserUtils.getElement("script-sudo-flag").disabled = !value;
			this.ctx.browserUtils.getElement("script-location").disabled = !value;
			this.ctx.browserUtils.getElement("execute-script-button").disabled = !value;
			this.ctx.browserUtils.getElement("find-script-button").disabled = !value;
		},

		buildRegexList: function() {
			this.logger.info("Building regex list...");
			var regexList = this.ctx.uiManager.getRegexList();
			this.ctx.uiManager.cleanHostList(regexList);

			var regexConfigs = this.ctx.dao.findAllRegexConfig();

			for (var i = 0; i < regexConfigs.length; i++) {
				var regexConfig = regexConfigs[i];

				var regex = regexConfig.regex;
				var color = regexConfig.color;

				var row = document.createElement('listitem');
				row.setAttribute('value', regex);
				row.setAttribute('color', color);

				var regexCell = document.createElement('listcell');
				regexCell.setAttribute('label', regex);
				row.appendChild(regexCell);

				var colorCell = document.createElement('listcell');
				colorCell.setAttribute('label', '\u25A0');
				colorCell.setAttribute('value', color);
				colorCell.setAttribute('class', 'color');
				colorCell.setAttribute('style', 'color: ' + color);
				row.appendChild(colorCell);

				regexList.appendChild(row);
			}

			this.ctx.browserUtils.getElement("edit-regex-button").setAttribute("disabled", "true");
			this.ctx.browserUtils.getElement("remove-regex-button").setAttribute("disabled", "true");
		},

		addRegex: function() {
			var defaultColor = this.ctx.preferenceUtils.getString("definition-color");
			var regexList = this.ctx.uiManager.getRegexList();
			var existingRegex = new Array();
			var count = regexList.getRowCount();
			for (var i = 0; i < count; i++) {
				existingRegex.push(regexList.getItemAtIndex(i).value);
			}

			var params = {
				inn: {
					color: defaultColor,
					existingRegex: existingRegex
				},
				out: null
			};
			window.openDialog("chrome://changeHosts/content/dialogs/regexDialog.xul", "showmore", "chrome, dialog, modal, centerscreen", params).focus();

			var out = params.out;
			if (out) {
				var regex = out.regex;
				var color = out.color;

				this.ctx.dao.saveOrUpdateRegexConfig(regex, color);
				this.buildRegexList();

				this.ctx.uiManager.setCurrentColor();
				this.reloadTree();
			}
		},

		editRegex: function() {
			var regexList = this.ctx.uiManager.getRegexList();
			var regexToEdit = regexList.selectedItem.value;
			var regexColor = regexList.selectedItem.getAttribute('color');

			var params = {
				inn: {
					regex: regexToEdit,
					color: regexColor
				},
				out: null
			};
			window.openDialog("chrome://changeHosts/content/dialogs/regexDialog.xul", "showmore", "chrome, dialog, modal, centerscreen", params).focus();

			var out = params.out;
			if (out) {
				var regex = out.regex;
				var color = out.color;

				this.ctx.dao.saveOrUpdateRegexConfig(regex, color);
				this.buildRegexList();

				this.ctx.uiManager.setCurrentColor();
				this.reloadTree();
			}
		},

		removeRegex: function() {
			var regexList = this.ctx.uiManager.getRegexList();
			var regexToRemove = regexList.selectedItem.value;

			var msg = this.ctx.preferenceUtils.getSBundle().getString("cH.removeRegex");

			var remove = confirm(msg);
			if (remove) {
				this.ctx.dao.removeRegexConfig(regexToRemove);
				this.buildRegexList();

				this.ctx.uiManager.setCurrentColor();
				this.reloadTree();
			}
		},

		reloadTree: function(){
			var tree = this.ctx.uiManager.getHostDirTree();
			this.optionsDefinitions.reloadTree(tree);
			this.optionsDefinitions.setTreeSelection(tree);
		},

		handleRegexListClick: function(listbox) {
			this.ctx.browserUtils.getElement("edit-regex-button").removeAttribute("disabled");
			this.ctx.browserUtils.getElement("remove-regex-button").removeAttribute("disabled");
		}
	};

	window.addEventListener("load", function() {
		try {
			coders.changeHosts.options.general.onLoad();
		} catch (e) {
			console.log("Error loading general options: " + e);
		}
	}, false);
})();
