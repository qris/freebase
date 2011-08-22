/*
 * Google Closure is required for everything. Load it first. And then
 * goog.events.EventType, goog.events.EventTarget.
 */

goog.provide('com.qwirx.freebase');
goog.provide('com.qwirx.freebase.Freebase');
goog.require('com.qwirx.freebase.DocumentEditor');

goog.require('goog.events.EventTarget');
goog.require('goog.ui.TabBar');
goog.require('goog.ui.Textarea');
goog.require('goog.ui.TextareaRenderer');
goog.require('goog.ui.SplitPane');
goog.require('goog.ui.tree.TreeControl');

com.qwirx.freebase.import = function(target_namespace /* packages... */)
{
	goog.object.extend.apply(null, arguments);
}

com.qwirx.freebase.FunctionStringifier = function(key, value)
{
	if (goog.isFunction(value))
	{
		var v = value.toString();
		return v;
	}
	else if (goog.isString(value))
	{
		return value;
	}
	else
	{
		if (goog.isObject(value))
		{
			for (var k in value)
			{
				value[k] = arguments.callee(k, value[k]);
			}
		}
		
		if (goog.isArray(value))
		{
			var length = value.length;
		
			for (var i = 0; i < value.length; i++)
			{
				value[i] = arguments.callee(k, value[i]);
			}
		}
	
		return value;
	}
};

/*
com.qwirx.freebase.Freebase = function(database)
{
	this.database = database;
};

goog.inherits(com.qwirx.freebase.Freebase, goog.events.EventTarget);
*/

com.qwirx.freebase.Freebase.getTableId = function(table_name)
{
	return '_design/' + table_name;
};

com.qwirx.freebase.Freebase.isTableId = function(object_id)
{
	return object_id.indexOf('_design/') == 0;
};

com.qwirx.freebase.Freebase.INTERNAL_FIELD_PREFIX = "$";
com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX = 
	com.qwirx.freebase.Freebase.INTERNAL_FIELD_PREFIX + "fb_";
com.qwirx.freebase.Freebase.TABLE_FIELD = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + "table";
com.qwirx.freebase.Freebase.CLASS_FIELD = 
	com.qwirx.freebase.Freebase.FREEBASE_FIELD_PREFIX + "class";

com.qwirx.freebase.DocumentSaved = function(document, database)
{
	this.type = com.qwirx.freebase.DocumentSaved.EVENT_TYPE;
	this.document_ = document;
	this.database_ = database;
}

goog.inherits(com.qwirx.freebase.DocumentSaved, goog.events.Event);

com.qwirx.freebase.DocumentSaved.EVENT_TYPE = 'DocumentSaved';

com.qwirx.freebase.DocumentSaved.prototype.getDocument = function()
{
	return this.document_;
}

/**
 * This is the constructor for a Table document, which stores the structure
 * (columns) and built-in views of a table. A table in Freebase is the
 * subset of our documents which have their "table" property set to the name
 * of this table. Tables documents are design documents, so they contain
 * views. All documents in the table are returned by the "all" view in its
 * design document.
 */
com.qwirx.freebase.TableDocument = function(name, columns)
{
	this._id = com.qwirx.freebase.Freebase.getTableId(name);
	this.name = name;
	this.columns = columns;
	
	// the only required view in a table is "all"
	this.views = {
		all: {
			map: "function(doc) " +
				"{ " +
				"if (doc." + com.qwirx.freebase.Freebase.TABLE_FIELD + " == '" + name + "') { " +
				"emit(doc._id, doc);" +
				"} " +
				"}"
		}
	};
};

com.qwirx.freebase.ModelClass = function modelObjectConstructor()
{
};

com.qwirx.freebase.ModelClass.findAll = function(params, successCallback, errorCallback)
{
	var self = this;
	
	if (this == com.qwirx.freebase.ModelClass)
	{
		throw new Error(arguments.callee.name + " is only valid on a " +
			"derived model class created by Model()");
	}
	
	this.freebase.findAll(this.modelName,
		function(results)
		{
			var l = results.length;

			for (var i = 0; i < l; i++)
			{
				var result = results[i];
				// call the constructor to build a model object from
				// the database record
				results[i] = new self(result);
			}
			
			successCallback(results);
		},
		errorCallback);
};

/**
 * Returns the unique identifier of this model in the database, whether
 * or not the model has actually been saved in the database. The format
 * of the ID will depend on the kind of database that the model is
 * constructed for.
 */
com.qwirx.freebase.ModelClass.getId = function()
{
	return com.qwirx.freebase.Freebase.getTableId(this.modelName);
};

/**
 * Converts a model *class* to its storable document form, a Model
 * Document, from which the class can be reconstructed with
 * Model.fromDocument(doc).
 */
 
com.qwirx.freebase.ModelClass.toDocument = function()
{
	return {
		_id: this.getId(),
		modelName: this.modelName,
		columns: this.columns,
		views: {
			// the only required view in a table is "all"
			all: {
				map: "function(doc) " +
					"{ " +
					"if (doc." + com.qwirx.freebase.Freebase.TABLE_FIELD +
						" == '" + this.modelName + "') { " +
					"emit(doc._id, doc); " +
					"} " +
					"}"
			}
		}
	};
};

/**
 * Converts a model *instance* (an object) to its storable document
 * form, i.e. plain JSON.
 */
com.qwirx.freebase.ModelClass.prototype.toDocument = function()
{
	return JSON.parse(JSON.stringify(this));
};

/**
 * Not exactly a constructor, this function creates and returns a new
 * class for the new model. It's not an instance of Model, so don't
 * call it with new Model(), just Model().
 *
 * Note: these Model classes are NOT saved in the database. They can't be,
 * because they contain functions. However, a document that describes them
 * should be saved in the database, which includes the view that allows
 * selecting all objects of that Model. Freebase will construct the Model
 * class for any model documents stored in the database when opening the
 * database, and add them to its app.models namespace.
 *
 * Newly created Models should have their model documents saved in the
 * database with myFreebase.save(myModel.toDocument()) before saving any
 * objects that refer to them. This will add the new model to the
 * app.models namespace.
 */
com.qwirx.freebase.Model = function(name, freebase, columns)
{
	// constructor for new instances of models
	var dynamicClass = function(attributes)
	{
		for (var i in attributes)
		{
			if (attributes.hasOwnProperty(i))
			{
				this[i] = attributes[i];
			}
		}
		
		// ensure that they know what table they belong to
		this[com.qwirx.freebase.Freebase.TABLE_FIELD] = name;
	};

	dynamicClass.prototype = com.qwirx.freebase.ModelClass.prototype;
	
	// replace the constructor property lost by replacing the prototype
	dynamicClass.prototype.constructor = dynamicClass;
	
	// static members
	goog.object.extend(dynamicClass, com.qwirx.freebase.ModelClass);	
	goog.object.extend(dynamicClass, 
	{
		modelName: name,
		freebase: freebase,
		columns: columns
	});
	
	return dynamicClass;
};

/**
 * Construct a Model from a Model Document, as returned by
 * ModelClass.toDocument and/or stored in the database.
 */
com.qwirx.freebase.Model.fromDocument = function(document, freebase)
{
	return Model(document.modelName, freebase, document.columns);
};

/*
com.qwirx.freebase.TableDocument.prototype.instantiate = function(attributes)
{
	var doc
	com.qwirx.freebase.extend(this, attributes);
	this[com.qwirx.freebase.Freebase.TABLE_FIELD] = name;
}
*/

/**
 * Directories from which Freebase libraries will be loaded, relative to the HTML page
 * @type {string}
 */
// com.qwirx.freebase.Freebase.prototype.LIB_DIR = "src";

/**
 * Directories from which external dependency libraries will be loaded, relative to the HTML page
 * @type {string}
 */
// com.qwirx.freebase.Freebase.prototype.extLibDir = "ext";

/**
 * A container for the document area, that sizes itself using HTML
 * tables to fill the entire space.
 *
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Container}
 */
com.qwirx.freebase.DocumentArea = function(opt_domHelper)
{
	goog.ui.Component.call(this);
};
goog.inherits(com.qwirx.freebase.DocumentArea, goog.ui.Component);

/**
 * Creates the initial DOM representation for the component.
 */
com.qwirx.freebase.DocumentArea.prototype.createDom = function()
{
	var table = this.element_ = this.dom_.createDom('table',
		{'class': 'fb-doc-area-table'});

	var tabsRow = this.dom_.createDom('tr',
		{'class': 'fb-doc-area-tabs-row'});
	goog.dom.appendChild(table, tabsRow);
	var tabsCell = this.tabsCell_ = this.dom_.createDom('td',
		{'class': 'fb-doc-area-tabs-cell'});
	goog.dom.appendChild(tabsRow, tabsCell);

	var docRow = this.docRow_ = this.dom_.createDom('tr',
		{'class': 'fb-doc-area-doc-row'});
	goog.dom.appendChild(table, docRow);  
	var docCell = this.docCell_ = this.dom_.createDom('td',
		{'class': 'fb-doc-area-doc-cell'});
	goog.dom.appendChild(docRow, docCell);  
};

/**
 * Returns the DOM element node for the tab bar portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getTabsCell = function()
{
	return this.tabsCell_;
}

/**
 * Returns the DOM element node for the document portion of the document
 * area.
 */
com.qwirx.freebase.DocumentArea.prototype.getDocCell = function()
{
	return this.docCell_;
}

com.qwirx.freebase.ConflictException = function(object, expectedRev,
	actualRev)
{
	this.object_      = object;
	this.expectedRev_ = expectedRev;
	this.actualRev_   = actualRev;
};

com.qwirx.freebase.ConflictException.prototype.toString = function()
{
	return "Conflicting changes to object " + this.object_ + ": " +
		"the object to be saved must have the same revision number " +
		"as the one in the database, " + this.expectedRev_ + ", but " +
		"it has revision " + this.actualRev_ + " instead, which " +
		"probably means that the one in the database was modified by " +
		"someone else inbetween.";
};

com.qwirx.freebase.Freebase.Gui = function(database)
{
	this.fb_ = database; // new com.qwirx.freebase.Freebase(database);
	var self = this;
	goog.events.listen(database, com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		function(event) { self.onDocumentSaved(event) }, true);
};

/**
 * Loads (adds to the current HTML document) a CSS stylesheet file,
 * whose name is relative to this Javascript file's path, and
 * without the .css extension.
 */
com.qwirx.freebase.Freebase.Gui.prototype.loadCss = function(/* varargs */)
{
	var len = arguments.length;
	for (var i = 0; i < len; i++)
	{
		var sheet = arguments[i];
		if (! window[sheet])
		{
			sheetUrl = sheet + ".css";
			linkTag = goog.dom.createDom(goog.dom.TagName.LINK,
				{rel: 'stylesheet', href: sheetUrl});
			goog.dom.appendChild(document.head, linkTag);
			window[sheet] = sheetUrl;
		}
	};
};

// Main entry function to start the Freebase application. Takes over the
// supplied {{{container}}}, which should be a jQuery selector or behave
// like one, and uses the supplied {{{jQuery}}} object to create new
// elements.

com.qwirx.freebase.Freebase.Gui.prototype.run = function(container)
{
	this.loadCss('../style/freebase');
	this.loadCss('../ext/closure-library/closure/goog/css/common');
	this.loadCss('../ext/closure-library/closure/goog/css/tab');
	this.loadCss('../ext/closure-library/closure/goog/css/tabbar');
	this.loadCss('../ext/closure-library/closure/goog/css/button');
	this.loadCss('../ext/closure-library/closure/goog/css/custombutton');
	// for ui-icon-close
	// this.loadCss('../ext/jquery-ui-themes/base/jquery.ui.theme');
	goog.dom.removeChildren(container);
	this.openDocumentsById_ = {};
	this.window = container;
	this.construct();
};


com.qwirx.freebase.Freebase.Gui.prototype.construct = function()
{
	this.loadCss('../ext/closure-library/closure/goog/css/tree');

	var treeConfig = goog.ui.tree.TreeControl.defaultConfig;
	treeConfig['cleardotPath'] = '../ext/closure-library/closure/' +
		'goog/images/tree/cleardot.gif';
	var navigator = this.navigator_ =
		new goog.ui.tree.TreeControl('localhost', treeConfig);

	var editArea = this.editArea_ = new com.qwirx.freebase.DocumentArea();
	
    // Set up splitpane with already existing DOM.
	var splitter = this.splitter_ = new goog.ui.SplitPane(navigator,
		editArea, goog.ui.SplitPane.Orientation.HORIZONTAL);
	splitter.render(goog.dom.getElement(this.window));
	splitter.setSize(new goog.math.Size('100%',300));
	
	var editAreaDocTabs = this.editAreaDocTabs_ = new goog.ui.TabBar();
	editAreaDocTabs.render(editArea.getTabsCell());
	
	goog.events.listen(navigator, goog.events.EventType.CHANGE,
		this.onDocumentOpen, false, this);
	
	var self = this;
	this.fb_.listAll(/* fetch document contents: true, */
		function(results)
		{
			var len = results.rows.length;
			for (var i = 0; i < len; i++)
			{
				var result = results.rows[i];
				var newNodeName = self.getDocumentLabel(result.doc);
				var newNode = self.navigator_.createNode(newNodeName);
				newNode.setModel({id: result.id});
				self.navigator_.addChild(newNode);
			}
		});
};

/**
 * Binary search on a sorted list, to find the correct insertion point
 * to maintain sort order.
 */
com.qwirx.freebase.binarySearch = function(countFn, compareFn)
{
	var left = 0;  // inclusive
	var right = countFn();  // exclusive
	var found;
	
	while (left < right)
	{
		var middle = (left + right) >> 1;
		var compareResult = compareFn(middle);
		if (compareResult > 0)
		{
			left = middle + 1;
		}
		else
		{
			right = middle;
			// We are looking for the lowest index so we can't return immediately.
			found = !compareResult;
		}
	}
	
	// left is the index if found, or the insertion point otherwise.
	// ~left is a shorthand for -left - 1.
	
	return found ? left : ~left;
};

/**
 * Binary search on a sorted tree (actually any BaseNode) to find the
 * correct insertion point to maintain sort order.
 */
com.qwirx.freebase.treeSearch = function(node, compareNodeFn, target)
{
	return com.qwirx.freebase.binarySearch(
		function countFn()
		{
			return node.getChildCount();
		},
		function compareFn(atIndex)
		{
			return compareNodeFn(target, node.getChildAt(atIndex));
		});
};

com.qwirx.freebase.treeLabelCompare = function(a, b)
{
	var ta = (a instanceof goog.ui.tree.BaseNode) ? a.getText() : a;
	var tb = (b instanceof goog.ui.tree.BaseNode) ? b.getText() : b;
	return goog.array.defaultCompare(ta, tb);
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentSaved = function(event)
{
	var newNodeName = event.getDocument()._id;
	var index = com.qwirx.freebase.treeSearch(this.navigator_,
		com.qwirx.freebase.treeLabelCompare, newNodeName);

	if (index < 0)
	{
		// need to insert
		index = ~index;
		var newNode = this.navigator_.createNode(newNodeName);
		newNode.setModel({id: event.getDocument()._id});
		this.navigator_.addChildAt(newNode, index);
	}
	else
	{
		// node already exists, nothing to do visually		
	}
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentOpen = function(event)
{
	this.openDocument(this.navigator_.getSelectedItem().getModel().id,
		function onSuccess(){});
};

com.qwirx.freebase.Freebase.Gui.prototype.getEditorContainer = function()
{
	return this.editArea_.getDocCell();
};

com.qwirx.freebase.Freebase.Gui.prototype.openDocument =
	function(openedId, onSuccess)
{
	var alreadyOpenEditor = this.openDocumentsById_[openedId];
	
	if (alreadyOpenEditor)
	{
		alreadyOpenEditor.activate();
		onSuccess(alreadyOpenEditor);
	}
	else
	{
		var self = this;
		return this.fb_.get(openedId,
			function onGetSuccess(document)
			{
				var editor = self.openDocumentsById_[openedId] =
					new com.qwirx.freebase.DocumentEditor(self,
						self.fb_,
						document,
						self.editAreaDocTabs_,
						self.getEditorContainer());
				onSuccess(editor);
			},
			function onError(exception)
			{
				self.onError(exception);
			});
	}
};

com.qwirx.freebase.Freebase.Gui.prototype.onError = function(exception)
{
	alert(exception);
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentClose = function(documentEditor)
{
	var documentId = documentEditor.documentId_;
	delete this.openDocumentsById_[documentId];
};

jQuery = {};
jQuery.extend = function() { };

jQuery.extend(com.qwirx.freebase.Freebase.prototype, // class methods
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
