/*
 * Google Closure is required for everything. Load it first. And then
 * goog.events.EventType, goog.events.EventTarget.
 */

goog.provide('com.qwirx.freebase');
goog.provide('com.qwirx.freebase.Freebase');
goog.require('com.qwirx.loader');
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

com.qwirx.freebase.Freebase = function()
{
	this.app = {models: {}};
};

goog.inherits(com.qwirx.freebase.Freebase, goog.events.EventTarget);

com.qwirx.freebase.Freebase.prototype.instantiateModel_ = 
	function(object)
{
	var table = object[com.qwirx.freebase.Freebase.TABLE_FIELD];
	var model = this.app.models[table];
	
	if (table && model)
	{
		// call the constructor to build a model object
		// from the database record
		return new model(object);
	}
	else
	{
		return object;
	}
};

com.qwirx.freebase.Freebase.prototype.getTableId = function(table_name)
{
	return '_design/' + table_name;
};

com.qwirx.freebase.Freebase.prototype.isTableId = function(object_id)
{
	return object_id.indexOf('_design/') == 0;
};

com.qwirx.freebase.Freebase.prototype.getDocumentId = goog.abstractMethod;

com.qwirx.freebase.Freebase.prototype.setDocumentId = goog.abstractMethod;

com.qwirx.freebase.Freebase.prototype.prepareObjectForSave_ = 
	function(object)
{
	var document;
	
	if (object.toDocument)
	{
		document = object.toDocument();
	}
	else
	{
		document = object;
	}
	
	if (document.modelName)
	{
		this.setDocumentId(document,
			this.getTableId(document.modelName));
	}
	
	return document;
};

com.qwirx.freebase.Freebase.prototype.saveOrCreate_ = 
	function(object, failIfExists, implementation,
		onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	var document = this.prepareObjectForSave_(object);
	var self = this;
	
	implementation.call(this, document,
		function save_onSuccess(updated_document)
		{
			/* The implementation should have assigned _id and _rev
			 * to the document object already, but not to the Model
			 * (if any) which it never saw.
			 */
			if (object.setId)
			{
				object.setId(self.getDocumentId(updated_document));
			}
			else
			{
				object._id = self.getDocumentId(updated_document);
			}
			
			object._rev = updated_document._rev;
			
			if (document.modelName)
			{
				self.app.models[document.modelName] = 
					object.fromDocument(document, self);
			}

			self.dispatchEvent(new DocumentSaved(object));
			onSuccess(object);
		},
		onError);
};

com.qwirx.freebase.Freebase.prototype.saveReal_ = goog.abstractMethod;

/**
 * Saves the provided object into the Freebase database. An ID will
 * be assigned, either by the getObjectId() method if it's a Model
 * or TableDocument, or by the database. Calls _saveReal() which
 * must be overridden by a concrete subclass to implement the actual
 * saving.
 */
com.qwirx.freebase.Freebase.prototype.save = 
	function(object, onSuccess, onError)
{
	this.saveOrCreate_(object, false, this.saveReal_, onSuccess,
		onError);
};

/**
 * Create a new document. If the _id property is set and a document
 * with this ID already exists, this method will report an error
 * instead of replacing it.
 */
com.qwirx.freebase.Freebase.prototype.createReal$_ = goog.abstractMethod;

com.qwirx.freebase.Freebase.prototype.create$ = 
	function(object, onSuccess, onError)
{
	this.saveOrCreate_(object, true, this.createReal$_, onSuccess,
		onError);
};

com.qwirx.freebase.Freebase.prototype.deleteReal_ = goog.abstractMethod;

/**
 * Deletes the supplied object from the Freebase database.
 */
com.qwirx.freebase.Freebase.prototype.deleteDoc = 
	function(object, onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	var document = this.prepareObjectForSave_(object);
	var self = this;

	this.deleteReal_(object, 
		function Freebase_deleteDoc_onSuccess(result)
		{
			if (document.modelName)
			{
				delete self.app.models[document.modelName];
			}
			
			onSuccess.call(self, result);
		}, onError);
};

com.qwirx.freebase.Freebase.prototype.defaultOnErrorHandler_ = 
	function(freebase, object, exception)
{
	throw exception;
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

com.qwirx.freebase.ModelBase.findAll = function(params, successCallback,
	errorCallback)
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
 * Returns the unique identifier of this model in the database. This
 * is only defined if the Model has been saved already, and its format
 * will depend on the kind of database that the model is saved in.
 */
com.qwirx.freebase.ModelBase.getId = function()
{
	return this._id;
};

/**
 * Sets the unique identifier of this model after being saved in
 * the database.
 */
com.qwirx.freebase.ModelBase.setId = function(newId)
{
	this._id = newId;
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
		_rev: this._rev, // needed to update models in CouchDB
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
 * Note: these Model classes are NOT directly saved in the database.
 * They can't be, because they contain functions. However, you should
 * still save them using FreeBase.save() or create$(), which will
 * detect that a Model is being saved, convert it to a document,
 * and set its ID property to the ID of the document, which may be
 * special ID (e.g. _design/ModelName) depending on the database
 * backend. The document may also contain a view called "all", which
 * allows efficient searching for all instances of the Model.
 *
 * Newly created Models should have their model documents saved in the
 * database with myFreebase.save(MyModel) before saving any objects
 * of their class. This will add the new model to the app.models
 * namespace.
 *
 * Freebase will construct the Model class for any model documents
 * stored in the database when opening the database, and add them to
 * its app.models namespace.
 *
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
com.qwirx.freebase.ModelBase.fromDocument = function(document, freebase)
{
	return com.qwirx.freebase.Model(document.modelName, freebase,
		document.columns);
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

com.qwirx.freebase.Exception = function()
{
	if (Error.captureStackTrace)
	{
		Error.captureStackTrace(this, this.constructor);
	}
};

com.qwirx.freebase.DuplicateException = function(savingObject,
	existingObject)
{
	com.qwirx.freebase.Exception.call(this);
	this.saving_   = savingObject;
	this.existing_ = existingObject;
};

goog.inherits(com.qwirx.freebase.DuplicateException,
	com.qwirx.freebase.Exception);

com.qwirx.freebase.DuplicateException.prototype.toString = function()
{
	return "Failed to create object " + this.saving_ + ": " +
		"an object with the same ID already exists in the database: " +
		this.existing_;
};

com.qwirx.freebase.ConflictException = function(object, expectedRev,
	actualRev)
{
	com.qwirx.freebase.Exception.call(this);
	this.object_      = object;
	this.expectedRev_ = expectedRev;
	this.actualRev_   = actualRev;
};

goog.inherits(com.qwirx.freebase.ConflictException,
	com.qwirx.freebase.Exception);

com.qwirx.freebase.ConflictException.prototype.toString = function()
{
	return "Conflicting changes to object " + this.object_ + ": " +
		"the object to be saved must have the same revision number " +
		"as the one in the database, " + this.expectedRev_ + ", but " +
		"it has revision " + this.actualRev_ + " instead, which " +
		"probably means that the one in the database was modified by " +
		"someone else inbetween.";
};

com.qwirx.freebase.NonexistentException = function(object)
{
	com.qwirx.freebase.Exception.call(this);
	this.object_ = object;
};

goog.inherits(com.qwirx.freebase.NonexistentException,
	com.qwirx.freebase.Exception);

com.qwirx.freebase.NonexistentException.prototype.toString = function()
{
	return "Failed to delete an object because it doesn't exist " +
		" in this database: " + this.object_;
};

com.qwirx.freebase.Freebase.Gui = function(database)
{
	this.fb_ = database; // new com.qwirx.freebase.Freebase(database);
	goog.events.listen(database, com.qwirx.freebase.DocumentSaved.EVENT_TYPE,
		this.onDocumentSaved, false, this);
};

// Main entry function to start the Freebase application. Takes over the
// supplied {{{container}}}, which should be a DOM element.

com.qwirx.freebase.Freebase.Gui.prototype.run = function(container)
{
	com.qwirx.loader.loadCss('com.qwirx.freebase', 'freebase.css');
	com.qwirx.loader.loadCss('goog.closure', 'common.css',
		'tab.css', 'tabbar.css', 'button.css', 'custombutton.css');

	goog.dom.removeChildren(container);
	this.openDocumentsById_ = {};
	this.window = container;
	this.construct();
};

com.qwirx.freebase.Freebase.Gui.prototype.construct = function()
{
	com.qwirx.loader.loadCss('goog.closure', 'tree.css');

	var treeConfig = goog.ui.tree.TreeControl.defaultConfig;
	treeConfig['cleardotPath'] = '../closure-library/closure/' +
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

