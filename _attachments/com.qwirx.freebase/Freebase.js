goog.provide('com.qwirx.freebase.Freebase');

goog.require('com.qwirx.freebase.AutomaticFormView');
goog.require('com.qwirx.freebase.InstanceListView');
goog.require('com.qwirx.freebase.DocumentArea');
goog.require('com.qwirx.loader');
goog.require('com.qwirx.util.Tree');

goog.require('goog.debug.Logger');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventType');
goog.require('goog.ui.CustomButton');
goog.require('goog.ui.CustomButtonRenderer');
goog.require('goog.ui.SplitPane');
goog.require('goog.ui.Tab');
goog.require('goog.ui.TabBar');
goog.require('goog.ui.Textarea');
goog.require('goog.ui.TextareaRenderer');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.tree.TreeControl');

com.qwirx.freebase.import = function(target_namespace /* packages... */)
{
	goog.object.extend.apply(null, arguments);
}

/**
 * @constructor
 */
com.qwirx.freebase.Freebase = function()
{
	this.app = {models: {}};
};

goog.inherits(com.qwirx.freebase.Freebase, goog.events.EventTarget);

/**
 * Converts a document into an instance of a model, if the model
 * is known to this Freebase database. If not, the same document
 * (JSON) object is returned.
 *
 * All documents returned by a Freebase database should be passed
 * through instantiateModel_ unless otherwise specified in their
 * documentation. This allows you to treat them as real objects,
 * call their specific methods, etc.
 */
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
	if (!goog.isObject(object) || goog.isArray(object))
	{
		throw new Error("You can only pass an object to " +
			"prepareObjectForSave_(), not a " + goog.typeOf(object));
	}
	
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
	function(object_or_array, failIfExists, implementation,
		onSuccess, onError)
{
	onError = onError || this.defaultOnErrorHandler_;
	
	var objects;
	
	if (goog.isArray(object_or_array))
	{
		objects = object_or_array;
	}
	else
	{
		objects = [object_or_array];
	}
	
	var currentIndex = -1;
	var self = this;
	
	function saveOrCreateOne()
	{
		currentIndex++;
		
		if (currentIndex >= objects.length)
		{
			onSuccess(objects);
			return;
		}
			
		var object = objects[currentIndex];
		var document = self.prepareObjectForSave_(object);
		
		implementation.call(self, document,
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

				self.dispatchEvent(new com.qwirx.freebase.DocumentSaved(object));
				saveOrCreateOne();
			},
			onError);
	}
	
	saveOrCreateOne();
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
	function(exception, object)
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


