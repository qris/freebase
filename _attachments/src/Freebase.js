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

com.qwirx.freebase.ModelBase = function modelObjectConstructor()
{
};

com.qwirx.freebase.ModelBase.findAll = function(params, successCallback, errorCallback)
{
	var self = this;
	
	if (this == com.qwirx.freebase.ModelBase)
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
com.qwirx.freebase.ModelBase.getId = function()
{
	return com.qwirx.freebase.Freebase.getTableId(this.modelName);
};

/**
 * Converts a model *class* to its storable document form, a Model
 * Document, from which the class can be reconstructed with
 * Model.fromDocument(doc).
 */
 
com.qwirx.freebase.ModelBase.toDocument = function()
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
com.qwirx.freebase.ModelBase.prototype.toDocument = function()
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
com.qwirx.freebase.Model = function(modelName, freebase, columns)
{
	columns = columns.slice(0); // copy
	
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
		this[com.qwirx.freebase.Freebase.TABLE_FIELD] = modelName;
	};
	
	function hiddenNamespace()
	{
		eval("var " + modelName + " = " + dynamicClass.toString());
		return eval(modelName);
	}
	
	dynamicClass = hiddenNamespace();
	goog.inherits(dynamicClass, com.qwirx.freebase.ModelBase);
	
	/*
	dynamicClass.prototype = com.qwirx.freebase.ModelBase.prototype;
	
	// replace the constructor property lost by replacing the prototype
	dynamicClass.prototype.constructor = dynamicClass;
	*/
	
	// static members
	goog.object.extend(dynamicClass, com.qwirx.freebase.ModelBase);	
	goog.object.extend(dynamicClass, 
	{
		modelName: modelName,
		freebase: freebase,
		columns: columns
	});
	
	return dynamicClass;
};

/**
 * Construct a Model from a Model Document, as returned by
 * ModelBase.toDocument and/or stored in the database.
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
	goog.events.listen(database, com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
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
		this.onNavigatorClicked, false, this);
	
	var self = this;
	this.fb_.listAll(/* fetch document contents: */ true,
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

com.qwirx.freebase.Freebase.Gui.prototype.getDocumentLabel = function(document)
{
	return document._id;
};

com.qwirx.freebase.Freebase.Gui.prototype.onDocumentSaved = function(event)
{
	var newNodeName = this.getDocumentLabel(event.getDocument());
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

com.qwirx.freebase.Freebase.Gui.prototype.onNavigatorClicked = function(event)
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

