/*
 * Google Closure is required for everything. Load it first. And then
 * goog.events.EventType, goog.events.EventTarget.
 */

goog.provide('com.qwirx.freebase');
goog.require('goog.events.EventTarget');
goog.require('goog.ui.CustomButton');
goog.require('goog.ui.TabBar');
goog.require('goog.ui.Textarea');
goog.require('goog.ui.TextareaRenderer');
goog.require('goog.ui.SplitPane');
goog.require('goog.ui.tree.TreeControl');

/**
 * Copied from jQuery, some tools that we really want and Closure
 * doesn't give us.
 */

/*
// See jQuery's test/unit/core.js for details concerning isFunction.
// Since version 1.3, DOM methods and functions like alert
// aren't supported. They return false on IE (#2968).
com.qwirx.freebase.isFunction = function( obj ) {
	return toString.call(obj) === "[object Function]";
};

com.qwirx.freebase.isArray = function( obj ) {
	return toString.call(obj) === "[object Array]";
};

com.qwirx.freebase.isPlainObject = function( obj ) {
	// Must be an Object.
	// Because of IE, we also have to check the presence of the constructor property.
	// Make sure that DOM nodes and window objects don't pass through, as well
	if ( !obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval ) {
		return false;
	}
	
	// Not own constructor property must be Object
	if ( obj.constructor
		&& !hasOwnProperty.call(obj, "constructor")
		&& !hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf") ) {
		return false;
	}
	
	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.

	var key;
	for ( key in obj ) {}
	
	return key === undefined || hasOwnProperty.call( obj, key );
};

com.qwirx.freebase.isEmptyObject = function( obj ) {
	for ( var name in obj ) {
		return false;
	}
	return true;
};

com.qwirx.freebase.extend = function()
{
	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !com.qwirx.freebase.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging object literal values or arrays
				var recurse = com.qwirx.freebase.isPlainObject(copy) ||
					com.qwirx.freebase.isArray(copy);
				
				if (deep && copy && recurse)
				{
					var sourceIsCopyable = com.qwirx.freebase.isPlainObject(src) ||
						com.qwirx.freebase.isArray(src);
					var clone;
					if (src && sourceIsCopyable)
					{
						clone = src;
					}
					else if (com.qwirx.freebase.isArray(copy))
					{
						clone = [];
					}
					else
					{
						clone = {};
					}

					// Never move original objects, clone them
					target[name] = com.qwirx.freebase.extend(deep, clone, copy);
				}
				else if (copy !== undefined)
				// Don't bring in undefined values
				{
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};
*/

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

/**
 * Main class for the Freebase application.
 * @constructor
 */

com.qwirx.freebase.Freebase = {}

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

com.qwirx.freebase.Freebase.TABLE_FIELD = "$fb_table";
com.qwirx.freebase.Freebase.CLASS_FIELD = "$fb_class";

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

/**
 * A container that knows how to render its children, unlike
 * {@link goog.ui.Component}.
 *
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Container}
 */
com.qwirx.freebase.Container = function(opt_domHelper)
{
	goog.ui.Component.call(this);
};
goog.inherits(com.qwirx.freebase.Container, goog.ui.Component);

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
	this.openDocumentsById_ = {};
	this.window = container;
	this.construct();
	this.refresh();
};

com.qwirx.freebase.CloseButtonRenderer =
	goog.ui.ControlRenderer.getCustomRenderer(goog.ui.CustomButtonRenderer,
		'fb-tab-close-button');

com.qwirx.freebase.CloseButton = function(opt_renderer, opt_domHelper)
{
	var domHelper = opt_domHelper || goog.dom.getDomHelper();
	var closeIconElement = domHelper.createDom('span',
		'fb-tab-close-icon', '');
	goog.ui.CustomButton.call(this, closeIconElement,
		opt_renderer || com.qwirx.freebase.CloseButtonRenderer,
		opt_domHelper);
	this.addClassName('fb-tab-close-button');
	// this.addClassName('ui-icon');
	// this.addClassName('ui-icon-close');
};
goog.inherits(com.qwirx.freebase.CloseButton, goog.ui.CustomButton);

/**
 * Override to prevent bubbling up of events, where the tab containing
 * the button then handles the mouse down event, stealing the focus,
 * which deactivates the button and defeats the action event on mouseup.
 */
com.qwirx.freebase.CloseButton.prototype.handleMouseDown = function(e)
{
	com.qwirx.freebase.CloseButton.superClass_.handleMouseDown.call(this, e);
	e.stopPropagation();
};

com.qwirx.freebase.ClosableTab = function(caption)
{
	goog.ui.Tab.call(this, caption);
	/*
	var closeDom = this.getDomHelper().createDom('span',
		'fb-tab-closebox ui-icon ui-icon-close', '');
	var closeButton = new goog.ui.Button(closeDom);
	this.addChild(closeButton);
	*/
};

goog.inherits(com.qwirx.freebase.ClosableTab, goog.ui.Tab);

com.qwirx.freebase.ClosableTab.prototype.createDom = function(tab)
{
	var self = this;
	var element = com.qwirx.freebase.ClosableTab.superClass_.createDom.call(this, tab);
	var closeButton = new com.qwirx.freebase.CloseButton();
	closeButton.render(this.getElement());
	
	goog.events.listen(closeButton, goog.ui.Component.EventType.ACTION,
		this.close, false, this);
        
	return element;
};

com.qwirx.freebase.ClosableTab.prototype.close = function()
{
	var closeEvent = new goog.events.Event(goog.ui.Component.EventType.CLOSE,
		this);
	return this.dispatchEvent(closeEvent);	
};

com.qwirx.freebase.Grid = function(columns, opt_renderer)
{
	opt_renderer = opt_renderer || com.qwirx.freebase.Grid.Renderer;
	goog.ui.Control.call(this, null, opt_renderer);
	this.columns_ = columns.slice(0); // copy	
};

goog.inherits(com.qwirx.freebase.Grid, goog.ui.Control);

com.qwirx.freebase.Grid.Renderer = goog.ui.ControlRenderer.getCustomRenderer(
	goog.ui.ControlRenderer, 'fb-grid');

com.qwirx.freebase.Grid.prototype.createDom = function()
{
	this.element_ = this.dom_.createElement('table');

	var columns = this.columns_;
	var numCols = columns.length;
	var colHeadingCells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var th = column.tableCell = this.dom_.createDom('th', {},
			column.caption);
		colHeadingCells.push(th);
		
	}
	
	var headingRow = this.headingRow_ = this.dom_.createDom('tr', {},
		colHeadingCells);
	this.element_.appendChild(headingRow);
};

com.qwirx.freebase.Grid.prototype.addRow = function(columns)
{
	var numCols = columns.length;
	var cells = [];
	
	for (var i = 0; i < numCols; i++)
	{
		var column = columns[i];
		var td = column.tableCell = this.dom_.createDom('td', {},
			column.value);
		cells.push(td);
	}
	
	var newRow = this.dom_.createDom('tr', {}, cells);
	this.element_.appendChild(newRow);
};

com.qwirx.freebase.DocumentEditor = function(gui, freebase, document,
	opt_renderer, opt_tabbar, opt_editarea)
{
	this.gui_ = gui;
	this.freebase_ = freebase;
	this.document_ = document;
	this.documentId_ = (document ? document._id : null);
	
	if (opt_editarea)
	{
		var editorControl = this.editorControl_ = new goog.ui.Container(false,
			opt_renderer);
		editorControl.render(opt_editarea);
		
		if (this.documentId_ && Freebase.isTableId(this.documentId_))
		{
			// show all records in the table
			
			var columnsGridInfo = [];
			var numCols = document.columns.length;
			for (var i = 0; i < numCols; i++)
			{
				columnsGridInfo[i] = {caption: document.columns[i].name};
			}
			
			var grid = this.grid_ = new com.qwirx.freebase.Grid(columnsGridInfo);
			grid.addClassName('fb-datagrid');
			grid.render(editorControl.getElement());
			
			freebase.view(this.documentId_, 'all',
				function(all_results)
				{
					var num_rows = all_results.rows.length;
					
					for (var r = 0; r < num_rows; r++)
					{
						var result = all_results.rows[r];
						var columnCells = [];
				
						for (var c = 0; c < num_columns; c++)
						{
							var column = document.columns[c];
							var content = result.value[column.name];
							var cell = {value: content};
							columnCells.push(cell);
						}
						
						grid.addRow(columnCells);
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
	}

	if (opt_tabbar)
	{
		this.tabBar_ = opt_tabbar;
		var title = this.documentId_ || "Untitled";
		var tab = this.tab_ = new com.qwirx.freebase.ClosableTab(title);
		tab.setModel(this);
		gui.editAreaDocTabs_.addChild(tab, true /* render now */);
		gui.editAreaDocTabs_.setSelectedTab(tab);
		
		goog.events.listen(tab, goog.ui.Component.EventType.SELECT,
			this.onTabSelect, false, this);
		goog.events.listen(tab, goog.ui.Component.EventType.UNSELECT,
			this.onTabUnselect, false, this);
		goog.events.listen(tab, goog.ui.Component.EventType.CLOSE,
			this.onTabClose, false, this);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.activate = function()
{
	if (this.tab_)
	{
		this.tabBar_.setSelectedTab(this.tab_);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabSelect = function(event)
{
	if (this.editorControl_)
	{
		goog.style.showElement(this.editorControl_.getElement(), true);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabUnselect = function(event)
{
	if (this.editorControl_)
	{
		goog.style.showElement(this.editorControl_.getElement(), false);
	}
};

com.qwirx.freebase.DocumentEditor.prototype.onTabClose = function(event)
{
	this.close();
};

com.qwirx.freebase.DocumentEditor.prototype.close = function()
{
	if (this.tab_)
	{
		this.tabBar_.removeChild(this.tab_, true);
	}
	
	if (this.editorControl_)
	{
		this.editorControl_.dispose();
	}
	
	if (this.gui_)
	{
		this.gui_.onDocumentClose(this);
	}
};

com.qwirx.freebase.Freebase.Gui.prototype.construct = function()
{
	this.loadCss('../ext/closure-library/closure/goog/css/tree');

	var treeConfig = goog.ui.tree.TreeControl.defaultConfig;
	treeConfig['cleardotPath'] = '../ext/closure-library/closure/' +
		'goog/images/tree/cleardot.gif';
	var navigator = this.navigator_ =
		new goog.ui.tree.TreeControl('localhost', treeConfig);
	/*	
    var editor = this.editAreaDocTabs_    = new goog.ui.Textarea('Hi there, ' +
		'I am a programmatic textarea.');
	*/

	var editArea = this.editArea_ = new com.qwirx.freebase.DocumentArea();
	
    // Set up splitpane with already existing DOM.
	var splitter = this.splitter_ = new goog.ui.SplitPane(navigator,
		editArea, goog.ui.SplitPane.Orientation.HORIZONTAL);
	splitter.render(goog.dom.getElement(this.window));
	splitter.setSize(new goog.math.Size('100%',300));
	
	var editAreaDocTabs = this.editAreaDocTabs_ = new goog.ui.TabBar();
	editAreaDocTabs.render(editArea.getTabsCell());
	
	/*
	editor.addChild(new goog.ui.Tab('Hello',
		com.qwirx.freebase.ClosableTabRenderer.getInstance()),
		true);
	editor.addChild(new goog.ui.Tab('Test',
		com.qwirx.freebase.ClosableTabRenderer.getInstance()),
		true);
	editAreaDocTabs.addChild(new com.qwirx.freebase.ClosableTab('Hello'), true);
	editAreaDocTabs.addChild(new com.qwirx.freebase.ClosableTab('Test'),  true);
	*/

	goog.events.listen(navigator, goog.events.EventType.CHANGE,
		this.onDocumentOpen, false, this);
	/*
	goog.events.listen(editAreaDocTabs, goog.events.EventType.CHANGE,
		this.onDocumentSwitch, false, this);
	*/
	
	this.editAreaDocDivRenderer = goog.ui.ContainerRenderer.getCustomRenderer(
		goog.ui.ContainerRenderer, 'fb-edit-area-doc-div');
	
	/*
	var textarea = this.textarea_ = new goog.ui.Textarea('Hi there, ' +
		'I am a programmatic textarea.');
	textarea.render(goog.dom.getElement(this.window));
	*/
	
	return;
	
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
};

com.qwirx.freebase.Freebase.Gui.prototype.refresh = function()
{
	return;
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

/**
 * Binary search on a sorted tree (actually any BaseNode) to find the
 * correct insertion point to maintain sort order.
 */
com.qwirx.freebase.treeSearch = function(node, compareFn, target)
{
	var left = 0;  // inclusive
	var right = node.getChildCount();  // exclusive
	var found;
	
	while (left < right)
	{
		var middle = (left + right) >> 1;
		var compareResult = compareFn(target, node.getChildAt(middle));
		if (compareResult > 0) {
			left = middle + 1;
		} else {
			right = middle;
			// We are looking for the lowest index so we can't return immediately.
			found = !compareResult;
		}
	}
	
	// left is the index if found, or the insertion point otherwise.
	// ~left is a shorthand for -left - 1.
	
	return found ? left : ~left;
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
	var selectedNode = this.navigator_.getSelectedItem();
	var openedId = selectedNode.getModel().id;
	var alreadyOpenEditor = this.openDocumentsById_[openedId];
	
	if (alreadyOpenEditor)
	{
		alreadyOpenEditor.activate();
	}
	else
	{
		var self = this;
		this.fb_.get(openedId,
			function onSuccess(document)
			{
				self.openDocumentsById_[openedId] =
					new DocumentEditor(self, self.fb_, document,
						self.editAreaDocDivRenderer,
						self.editAreaDocTabs_,
						self.editArea_.getDocCell());
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

/*
com.qwirx.freebase.Freebase.Gui.prototype.onDocumentSwitch = function(event)
{
	if (this.activeEditor_)
	{
		this.activeEditor_.editDoc.getElement().style =
			"display: none;";
	}
	
	var activeTab = this.editAreaDocTabs_.getSelectedTab();
	var editor = this.activeEditor_ = activeTab.getModel();
	
	if (editor)
	{
		editor.editDoc.getElement().style = "display: block;";
	}
};
*/

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
