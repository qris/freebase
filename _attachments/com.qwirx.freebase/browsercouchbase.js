goog.provide('com.qwirx.freebase.BrowserCouchBase');

goog.require('com.qwirx.freebase.NonexistentException');

com.qwirx.freebase.BrowserCouchBase = function(browserCouch)
{
	com.qwirx.freebase.Freebase.call(this);
	this.browserCouch_ = browserCouch;
}

goog.inherits(com.qwirx.freebase.BrowserCouchBase,
	com.qwirx.freebase.Freebase);

/**
 * @return a particular document, instantiated as a model.
 */
com.qwirx.freebase.BrowserCouchBase.prototype.get = 
	function(documentId, onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	this.browserCouch_.get(documentId, onSuccess, onError);
};

/**
 * findAll calls the "all" view of the named design, (e.g.
 * /_design/Foo/view/all), extracts the objects returned from the results
 * and passes the array of objects (JSON documents) to the onSuccess callback.
 */
com.qwirx.freebase.BrowserCouchBase.prototype.findAll = 
	function(designName, onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	this.view('_design/' + designName, 'all',
		function BrowserCouchBase_findAll_onSuccess(results)
		{
			var objects = [];
			var l = results.rows.length;
			for (var i = 0; i < l; i++)
			{
				objects[i] = results.rows[i].value;
			}
			onSuccess(objects);
		},		
		onError);
};

/**
 * @return a list of all documents in key-value format, optionally
  * including all properties, but without instantiating models.
 *
 * @param fetchDocuments fetch and return all document properties,
 * not just _id and _rev.
 *
 * @param onSuccess callback on success, called with the list of
 * documents as its only parameter.
 */
com.qwirx.freebase.BrowserCouchBase.prototype.listAll = 
	function(fetchDocuments, onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	function BrowserCouchBase_listAll_map(o)
	{
		emit(o._id, o._rev);
	}

	var options = {
		map: BrowserCouchBase_listAll_map,
		finished: onSuccess,
		onError: onError,
	};
	
	this.browserCouch_.view(options);
};

com.qwirx.freebase.BrowserCouchBase.JavascriptPatternError = 
	function(name, code, pattern)
{
	this.name_ = name;
	this.code_ = code;
	this.pattern_ = pattern;
};

com.qwirx.freebase.BrowserCouchBase.JavascriptPatternError.prototype.toString =
	function()
{
	return "The " + this.name_ + " code did not match the required " +
		"pattern: the code was " + this.code_ + " and the required " +
		"pattern is " + this.pattern_;
};

/**
 * @return the result of executing the specified view, which will
 * be an array of documents, each containing the keys emitted by
 * the view.
 *
 * @param designId the ID of the design containing the view.
 * @param viewName the name of the view to execute.
 */
com.qwirx.freebase.BrowserCouchBase.prototype.view = 
	function(designId, viewName, onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;
	var self = this;

	this.get(designId,
		function BrowserCouchBase_view_onSuccess(designDoc)
		{
			var view = designDoc.views[viewName];
			
			var options = {
				design_doc: designId,
				view_name: viewName,
				finished: onSuccess,
				onError: onError,
			};
			
			var mapFunctionPattern = /^function *\(([^),]+)\) \{(.*)\}$/;
			var match = mapFunctionPattern.exec(view.map);
			if (!match)
			{
				return onError(self, designDoc,
					new com.qwirx.freebase.BrowserCouchBase.JavascriptPatternError(
						"map function", view.map, mapFunctionPattern));
			}
			options.map = new Function(match[1], "emit", match[2]);
			
			if (view.reduce)
			{
				eval("options.reduce = " + view.reduce);
			}
			
			self.browserCouch_.view(options);
		},
		onError);
};

/**
 * Helper function that returns a comparator, which sorts an array
 * by a specific named property which each element has.
 *
 * @param name the name of the property to sort by.
 */
com.qwirx.freebase.sortByProperty = function(name)
{
	return function(a, b)
	{
		if (a[name] < b[name])
		{
			return -1;
		}
		else if (a[name] > b[name])
		{
			return 1;
		}
		else
		{
			return 0;
		}
	};
};

/**
 * Save a document in the database. If a document with the same _id
 * already exists, it will be replaced, otherwise a new document will
 * be created. If the _id property of the document is not set, it
 * will be randomly assigned by the database.
 */
com.qwirx.freebase.BrowserCouchBase.prototype.saveReal_ = 
	function(object, onSuccess, onError)
{
	if (this.getDocumentId(object))
	{
		this.browserCouch_.put(object, onSuccess, {}, onError);
	}
	else
	{
		this.browserCouch_.post(object, onSuccess, {}, onError);
	}
};

com.qwirx.freebase.BrowserCouchBase.prototype.createReal$_ = 
	function(document, onSuccess, onError)
{
	var self = this;
	
	this.get(this.getDocumentId(document),
		function BrowserCouchBase_createReal$_onSuccess(foundDoc)
		{
			if (foundDoc && !foundDoc._deleted)
			{
				onError(self, document,
					new com.qwirx.freebase.DuplicateException(document,
						foundDoc));
			}
			else
			{
				self.browserCouch_.post(document, onSuccess, {}, onError);
			}
		},
		onError);
};

com.qwirx.freebase.BrowserCouchBase.prototype.deleteReal_ = 
	function(document, onSuccess, onError)
{
	var self = this;
	
	this.get(this.getDocumentId(document),
		function BrowserCouchBase_createReal$_onSuccess(foundDoc)
		{
			if (foundDoc && !foundDoc._deleted)
			{
				self.browserCouch_.del(document, onSuccess, onError);
			}
			else
			{
				onError(self, document,
					new com.qwirx.freebase.NonexistentException(document,
						foundDoc));
			}
		},
		onError);
	
};
	
com.qwirx.freebase.BrowserCouchBase.prototype.getDocumentId =
	function(document)
{
	return document._id;
};

com.qwirx.freebase.BrowserCouchBase.prototype.setDocumentId =
	function(document, newId)
{
	document._id = newId;
};

