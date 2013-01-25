goog.provide('com.qwirx.freebase.Model');
goog.provide('com.qwirx.freebase.ModelBase');

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
 * Construct a Model from a Model Document, as returned by
 * ModelBase.toDocument and/or stored in the database.
 */
com.qwirx.freebase.ModelBase.fromDocument = function(document, freebase)
{
	return com.qwirx.freebase.Model(document.modelName, freebase,
		document.columns);
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

