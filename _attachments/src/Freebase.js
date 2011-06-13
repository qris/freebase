// = {{{ Freebase }}} =
//
// Main class for the Freebase application.
//
// jQuery is required for everything. Load it first.

var Freebase_Prototype = {
	// === {{{ Freebase.libDir }}} ===
	// === {{{ Freebase.extLibDir }}} ===
	// === {{{ Freebase.themeDir }}} ===
	//
	// Directories from which libraries (internal and external) will be loaded,
	// relative to the HTML page that includes them (I know, this is ugly!)
	
	libDir: "src",
	extLibDir: "ext",
	themeDir: "ext/jquery-ui-themes/base",

	// ** {{{ Freebase.require() }}} **
	//
	// Adapted from BrowserCouch.ModuleLoader.require().
	// Loads each of the specified {{{libraries}}} (string or array) into
	// the page, and calls the callback when they've finished loading.
	//
	// Maybe we could use {{{couchapp_load}}} or Evently's {{{$$.app.require}}}
	// for this, if they're present?
	
	require: function(libs, callback)
	{
		var self = this,
			i = 0,
			lastLib = "";

		if (!jQuery.isArray(libs))
		{
			libs = [libs];
		}

		function loadNextLib()
		{
			if (lastLib && !window[lastLib])
			{
				throw new Error("Failed to load library: " + lastLib);
			}

			if (i == libs.length)
			{
				// all done, now call the callback
				callback();
			}
			else
			{
				var libName = libs[i];
				i += 1;

				if (window[libName])
				{
					loadNextLib();
				}
				else
				{
					var libUrl = libName + ".js";
					lastLib = libName;
					self._loadScript(libName, libUrl, window, loadNextLib);
				}
			}
		}

		loadNextLib();
	},

	_loadScript: function (libName, url, window, cb)
	{
		var doc = window.document;
		var script = doc.createElement("script");
		script.setAttribute("src", url);
		script.addEventListener(
			"load",
			function onLoad()
			{
				window[libName] = url;
				script.removeEventListener("load", onLoad, false);
				cb();
			},
			false
		);
		doc.body.appendChild(script);
	},

	// ** {{{ Freebase.loadCss() }}} **
	//
	// Similar to require(), but loads a CSS file, and takes no callback.

	loadCss: function(sheets)
	{
		var self = this;

		if (!jQuery.isArray(sheets))
		{
			sheets = [sheets];
		}

		jQuery.each(sheets, function(i, sheet)
		{
			if (! window[sheet])
			{
				sheetUrl = sheet + ".css";
				link = $('<link>').attr('rel', 'stylesheet');
				link.attr('href', sheetUrl).appendTo("head");
				window[sheet] = sheetUrl;
			}
		});
	},

	// == {{{ Freebase.run() }}} ==
	//
	// Main entry function to start the Freebase application. Takes over the
	// supplied {{{container}}}, which should be a jQuery selector or behave
	// like one, and uses the supplied {{{jQuery}}} object to create new
	// elements.

	run: function(container)
	{
		self = this;
		
		this.loadCss([self.themeDir + "/jquery.ui.all", "style/freebase"]);
				
		this.require(
			[
				self.extLibDir + "/browser-couch",
				self.extLibDir + "/jquery.ui.core",
				self.extLibDir + "/jquery.ui.widget",
				self.extLibDir + "/jquery.ui.mouse",
				self.extLibDir + "/jquery.ui.button",
				self.extLibDir + "/jquery.ui.draggable",
				self.extLibDir + "/jquery.ui.position",
				self.extLibDir + "/jquery.ui.resizable",
				self.extLibDir + "/jquery.ui.dialog"
			],
			function()
			{
				if (!self.window)
				{
					self.window = jQuery('<div />');
					self.construct();
				}

				container.empty();
				self.window.appendTo(container);
				self.window.dialog({autoOpen: false});
				self.window.dialog('open');
				
				self.refresh();
			});
	},
	
	construct: function()
	{
		var win = this.window.empty();
		this.nav = jQuery('<div />').attr('class', 'fb-nav').appendTo(win);
		this.list = jQuery('<div />').attr('class', 'fb-list').appendTo(win);
	},
	
	refresh: function()
	{
		var self = this;
		self.list.empty();
		
		self.database.view({
			map: function(doc)
			{
				emit(doc._id, null);
			},
			finished: function(results)
			{
				jQuery.each(results.rows,
					function(i, result)
					{
						var result_id = result.id;
						var div = jQuery('<div />').attr('class', 'fb-list-item');
						var link = jQuery('<a />').attr('href', '#' + result_id);
						link.click(function(e)
							{
								self.show(result_id);
								return false;
							});
						// give the link a label:
						link.append(document.createTextNode(result_id));
						div.append(link);
						self.list.append(div);
					});
			}
		});
	},
	
	show: function(docid)
	{
		alert(docid);
		
		function appendRow(table, title, input_controls)
		{
			var row = jQuery('<tr />');
			jQuery('<th />').text(title).appendTo(row);
			jQuery('<td />').append(input_controls).appendTo(row);
			row.appendTo(table);
		}
		
		var self = this;
		var dialog = jQuery('<div />').attr({'class':'fb-show'});
		var flash = jQuery('<div />').attr({'class':'fb-flash'});
		flash.hide();
		dialog.append(flash);
		
		self.database.get(docid,
			function(doc)
			{
				if ('controls' in doc)
				{
					// TODO render controls
				}
				else
				{
					// auto-render something usable

					var table = jQuery('<table />').attr({'class':'fb-doc-auto'});
					jQuery.each(doc,
						function(key, val)
						{
							if (key.indexOf('_') != 0)
							{
								var row = jQuery('<tr />');
								jQuery('<th />').text(key).appendTo(row);
							
								var td = jQuery('<td />');
								var input = jQuery('<input />');
								input.attr({
									name: key,
									value: val,
									type: 'text'
								});
								td.append(input);
								row.append(td);
								table.append(row);
							}
						});
						
					var row = jQuery('<tr />');
					jQuery('<th />').appendTo(row);
					
					var td = jQuery('<td />');
					var submit = jQuery('<input />');
					submit.attr({type: 'button', value: 'Save'});
					submit.click(function(e)
						{
							var newdoc = {_id: docid};
							dialog.find('input').each(function(index)
								{
									newdoc[this.name] = this.value;
								});
							self.database.put(newdoc, function()
								{
									flash.addClass('fb-success');
									flash.text('Document saved.');
									flash.show();
								});
						});
					td.append(submit);
					row.append(td);
					table.append(row);
					
					dialog.append(table);
					dialog.dialog();
				}
			});
	}
};

function Freebase(database)
{
	this.database = database;
};

Freebase.prototype = Freebase_Prototype;

