// = {{{ Freebase }}} =
//
// Main class for the Freebase application.
//
// jQuery is required for everything. Load it first.

function Freebase(database)
{
	this.database = database;
};

jQuery.extend(Freebase, // static methods
{
	table_id: function(table_name)
	{
		return '_design/' + table_name;
	},
	
	is_table: function(object_id)
	{
		return object_id.indexOf('_design/') == 0;
	},
	
	TABLE_FIELD: "$fb_table",
	
	/*
	This is the constructor for a Table document, which stores the structure
	(columns) and built-in views of a table. A table in Freebase is the
	subset of our documents which have their "table" property set to the name
	of this table. Tables documents are design documents, so they contain
	views. All documents in the table are returned by the "all" view in its
	design document.
	*/
	TableDocument: function(name, columns)
	{
		// return a function, not an object, so we can use it to create
		// records with e.g. new Message(...)
		var table_doc = function(attributes)
		{
			jQuery.extend(this, attributes);
			this[Freebase.TABLE_FIELD] = name;
		}
		
		table_doc._id = Freebase.table_id(name);
		table_doc.name = name;
		table_doc.columns = columns;
		
		// the only required view in a table is "all"
		table_doc.views = {
			all: {
				map: "function(doc) " +
					"{ " +
					"if (doc." + Freebase.TABLE_FIELD + " == '" + name + "') { " +
					"emit(doc._id, doc);" +
					"} " +
					"}"
			}
		};
		
		table_doc.toDocument = function()
		{
			var document = {};
			jQuery.extend(document, this);
			return document;
		};
		
		return table_doc;
	}
});

jQuery.extend(Freebase.prototype, // class methods
{
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
		this.open_editors = [];
		
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
				self.extLibDir + "/jquery.ui.dialog",
				self.extLibDir + "/jquery.ui.tabs"
			],
			function()
			{
				self.window = container;
				self.construct();
				self.refresh();
			});
	},
	
	construct: function()
	{
		var self = this;
		var win = this.window.empty();
		var table = jQuery('<table />').attr('class', 'fb-table').appendTo(win);
		var tr = jQuery('<tr />').appendTo(table);
		this.nav = jQuery('<td />').attr('class', 'fb-nav').appendTo(tr);
		this.edit_area = jQuery('<td />').attr('class', 'fb-edit-area').appendTo(tr);
		// jquery.ui.tabs requires a UL inside the area to be tabbed
		jQuery('<ul />').appendTo(this.edit_area);
		this.tabset = this.edit_area.tabs(
		{
			tabTemplate: "<li><a href='#{href}'>#{label}</a> " +
				"<span class='ui-icon ui-icon-close'>Remove Tab</span></li>",
			add: function(event, ui)
			{
				// select the newly added tab
				self.tabset.tabs('select', '#' + ui.panel.id);
				
				self.open_editors[ui.panel.id] = {
					tab_index: ui.index,
					panel: ui.panel
				};
			
				// http://jqueryui.com/demos/tabs/#manipulation	
				// close icon: removing the tab on click
				// note: closable tabs gonna be an option in the future - see http://dev.jqueryui.com/ticket/3924
				jQuery("span.ui-icon-close", ui.tab.parentNode).live("click",
					function()
					{
						var index = $("li", self.tabset).index($(this).parent());
						self.tabset.tabs("remove", index);
						delete self.open_editors[ui.panel.id];
					});
			}
		});
	},
	
	refresh: function()
	{
		var self = this;
		self.nav.empty();
		
		self.database.get('_all_docs',
			function(results)
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
						self.nav.append(div);
					});
			});
	},
	
	generate_id: function(/* varargs */)
	{
		var parts = [];
		
		for (var i = 0; i < arguments.length; i++)
		{
			// jQuery only allows these characters in IDs, and fails to
			// find the node otherwise.
			parts[i] = arguments[i].replace(/[^\w-]/g, '-');
		}
		
		return parts.join("-");	
	},

	show: function(docid)
	{
		var self = this;
		var dialog_id = this.generate_id("fb-editor", docid);
		if (dialog_id in this.open_editors)
		{
			this.tabset.tabs('option', 'selected',
				this.open_editors[dialog_id].tab_index);
			return;
		}
		
		var editor = jQuery('<div />');
		editor[0].id = dialog_id;
		this.edit_area.append(editor);
		this.tabset.tabs('add', '#' + dialog_id, docid);
		
		var flash = jQuery('<div />').attr({'class':'fb-flash'});
		flash.hide();
		editor.append(flash);
		
		self.database.get(docid,
			function(doc)
			{
				if (Freebase.is_table(docid))
				{
					// show all records in the table
					editor.attr({'class':'fb-datagrid-editor'});
					
					var table_tag = jQuery('<table />').attr({'class':'fb-datagrid'});
					table_tag.appendTo(editor);
					
					var columns = doc.columns;
					var tr = jQuery('<tr />').appendTo(table_tag);
					var num_columns = columns.length;
					
					for (var c = 0; c < num_columns; c++)
					{
						var th = jQuery('<th />').text(columns[c].name).appendTo(tr);
					}
					
					self.database.get(docid + "/_view/all",
						function(all_results)
						{
							var num_rows = all_results.rows.length;
							
							for (var r = 0; r < num_rows; r++)
							{
								var result = all_results.rows[r];
								var tr = jQuery('<tr />').appendTo(table_tag);
						
								for (var c = 0; c < num_columns; c++)
								{
									var column = columns[c];
									var content = result.value[column.name];
									var td = jQuery('<td />');
									td.text(content);
									td.appendTo(tr);
								}
							}
						});
				}
				else
				{
					// auto-render something usable
					editor.attr({'class':'fb-doc-editor'});

					var table = jQuery('<table />').attr({'class':'fb-doc-auto'});
					jQuery.each(doc,
						function(key, val)
						{
							var input = jQuery('<input />');
							
							input.attr({
								id: self.generate_id(dialog_id, key),
								name: key,
								value: val,
							});
							
							if (key.indexOf('_') != 0)
							{
								input.attr('type', 'text');

								var row = jQuery('<tr />');
								jQuery('<th />').text(key).appendTo(row);
							
								var td = jQuery('<td />');
								td.append(input);
								row.append(td);
								table.append(row);
							}
							else
							{
								input.attr('type', 'hidden');
								editor.append(input);
							}
						});
						
					var row = jQuery('<tr />');
					jQuery('<th />').appendTo(row);
					
					var rev = doc._rev;
					
					var td = jQuery('<td />');
					var submit = jQuery('<input />');
					submit.attr({type: 'button', value: 'Save'});
					submit.click(function(e)
						{
							var newdoc = {};
							
							editor.find('input').each(
								function(index)
								{
									if (this.name)
									{
										newdoc[this.name] = this.value;
									}
								});
							self.database.put(newdoc, function(updated_doc)
								{
									if (updated_doc) // otherwise the PUT failed
									{
										flash.removeClass('fb-error-flash');
										flash.addClass('fb-success-flash');
										flash.text('Document saved.');
										flash.show();
										var control = document.getElementById(
											self.generate_id(dialog_id, '_rev'));
										control.value = updated_doc.rev;
									}
								},
								{
									ajaxErrorHandler: function(jqXHR,
										textStatus, errorThrown)
									{
										flash.removeClass('fb-success-flash');
										flash.addClass('fb-error-flash');
										flash.text('Failed to save document: ' +
											textStatus + ' (' + errorThrown + ')');
										flash.show();
									}
								});
						});
					td.append(submit);
					row.append(td);
					table.append(row);
					
					editor.append(table);
				}
			});
	},
	
	errorHandler: function(exception)
	{
		alert(exception);
	},
	
	withErrorHandlers: function(handlers, protectedCode)
	{
		
	},
});
