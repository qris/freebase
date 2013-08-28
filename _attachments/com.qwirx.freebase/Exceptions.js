goog.provide('com.qwirx.freebase.Exception');
goog.provide('com.qwirx.freebase.DuplicateException');
goog.provide('com.qwirx.freebase.ConflictException');
goog.provide('com.qwirx.freebase.NonexistentException');

/**
	@namespace
	@name com.qwirx.freebase
*/

/**
 * The base class for exceptions thrown by Freebase.
 * @constructor
 */
com.qwirx.freebase.Exception = function()
{
	if (Error.captureStackTrace)
	{
		Error.captureStackTrace(this, this.constructor);
	}
};

/**
 * Thrown when an attempt was made to create an object which already exists
 * in the database, or another object with the same ID as an existing one.
 * @constructor
 */
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
		"an object with the same ID (" + this.saving_._id + ") " +
		"already exists in the database: " + this.existing_;
};

/**
 * Thrown when conflicting changes to an object (from different sources) 
 * are detected.
 * 
 * <p>The object to be saved must have the same revision number 
 * as the one already in the database, but it has a different revision 
 * number instead, which probably means that the one in the database was 
 * modified by someone else inbetween.
 * 
 * @constructor
 * @name com.qwirx.freebase.ConflictException
 */
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

/**
 * Thrown when Freebase fails to delete an object (as requested) because it
 * doesn't exist in the database.
 * @constructor
 */
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


