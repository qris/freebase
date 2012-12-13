goog.require('com.qwirx.freebase.BrowserCouchBase');
goog.require('com.qwirx.freebase.DuplicateException');
goog.require('com.qwirx.freebase.ConflictException');
goog.require('com.qwirx.freebase.NonexistentException');
goog.require('com.qwirx.grid.NavigableGrid');
goog.require('com.qwirx.test.FakeBrowserEvent');
goog.require('com.qwirx.test.FakeClickEvent');

goog.require('goog.dom.NodeIterator');

// import Freebase, TableDocument and other classes
com.qwirx.freebase.import(this, com.qwirx.freebase);

/**
 * Determines if two items of any type match, and formulates an error message
 * if not.
 * <p>
 * Copied and pasted from goog/testing/asserts.js just to add a limit
 * to the number of differences to avoid an infinite loop when
 * comparing objects with references to different DOM nodes.
 *
 * @param {*} expected Expected argument to match.
 * @param {*} actual Argument as a result of performing the test.
 * @return {?string} Null on success, error message on failure.
 */
goog.testing.asserts.findDifferences = function(expected, actual) {
  var failures = [];
  var seen1 = [];
  var seen2 = [];

  // To avoid infinite recursion when the two parameters are self-referential
  // along the same path of properties, keep track of the object pairs already
  // seen in this call subtree, and abort when a cycle is detected.
  // TODO(user,user): The algorithm still does not terminate in cases
  // with exponential recursion, e.g. a binary tree with leaf->root links.
  // Investigate ways to solve this without significant performance loss
  // for the common case.
  function innerAssert(var1, var2, path) {
  	if (failures.length > 100)
  	{
  		// It's already pretty borked. More information is not
  		// going to help.
  		return;
  	}
  	
    var depth = seen1.length;
    if (depth % 2) {
      // Compare with midpoint of seen ("Tortoise and hare" loop detection).
      // http://en.wikipedia.org/wiki/Cycle_detection#Tortoise_and_hare
      // TODO(user,user): For cases with complex cycles the algorithm
      // can take a long time to terminate, look into ways to terminate sooner
      // without adding more than constant-time work in non-cycle cases.
      var mid = depth >> 1;
      // Use === to avoid cases like ['x'] == 'x', which is true.
      var match1 = seen1[mid] === var1;
      var match2 = seen2[mid] === var2;
      if (match1 || match2) {
        if (!match1 || !match2) {
          // Asymmetric cycles, so the objects have different structure.
          failures.push('Asymmetric cycle detected at ' + path);
        }
        return;
      }
    }
    seen1.push(var1);
    seen2.push(var2);
    innerAssert_(var1, var2, path);
    seen1.pop();
    seen2.pop();
  }

  /**
   * @suppress {missingProperties} The map_ property is unknown to the compiler
   *     unless goog.structs.Map is loaded.
   */
  function innerAssert_(var1, var2, path) {
    if (var1 === var2) {
      return;
    }

    var typeOfVar1 = _trueTypeOf(var1);
    var typeOfVar2 = _trueTypeOf(var2);

    if (typeOfVar1 == typeOfVar2) {
      var isArray = typeOfVar1 == 'Array';
      var equalityPredicate = PRIMITIVE_EQUALITY_PREDICATES[typeOfVar1];
      if (equalityPredicate) {
        if (!equalityPredicate(var1, var2)) {
          failures.push(path + ' expected ' + _displayStringForValue(var1) +
                        ' but was ' + _displayStringForValue(var2));
        }
      } else if (isArray && var1.length != var2.length) {
        failures.push(path + ' expected ' + var1.length + '-element array ' +
                      'but got a ' + var2.length + '-element array');
      } else {
        var childPath = path + (isArray ? '[%s]' : (path ? '.%s' : '%s'));

        // if an object has an __iterator__ property, we have no way of
        // actually inspecting its raw properties, and JS 1.7 doesn't
        // overload [] to make it possible for someone to generically
        // use what the iterator returns to compare the object-managed
        // properties. This gets us into deep poo with things like
        // goog.structs.Map, at least on systems that support iteration.
        if (!var1['__iterator__']) {
          for (var prop in var1) {
            if (isArray && goog.testing.asserts.isArrayIndexProp_(prop)) {
              // Skip array indices for now. We'll handle them later.
              continue;
            }

            if (prop in var2) {
              innerAssert(var1[prop], var2[prop],
                          childPath.replace('%s', prop));
            } else {
              failures.push('property ' + prop +
                            ' not present in actual ' + (path || typeOfVar2));
            }
          }
          // make sure there aren't properties in var2 that are missing
          // from var1. if there are, then by definition they don't
          // match.
          for (var prop in var2) {
            if (isArray && goog.testing.asserts.isArrayIndexProp_(prop)) {
              // Skip array indices for now. We'll handle them later.
              continue;
            }

            if (!(prop in var1)) {
              failures.push('property ' + prop +
                            ' not present in expected ' +
                            (path || typeOfVar1));
            }
          }

          // Handle array indices by iterating from 0 to arr.length.
          //
          // Although all browsers allow holes in arrays, browsers
          // are inconsistent in what they consider a hole. For example,
          // "[0,undefined,2]" has a hole on IE but not on Firefox.
          //
          // Because our style guide bans for...in iteration over arrays,
          // we assume that most users don't care about holes in arrays,
          // and that it is ok to say that a hole is equivalent to a slot
          // populated with 'undefined'.
          if (isArray) {
            for (prop = 0; prop < var1.length; prop++) {
              innerAssert(var1[prop], var2[prop],
                          childPath.replace('%s', String(prop)));
            }
          }
        } else {
          // special-case for closure objects that have iterators
          if (goog.isFunction(var1.equals)) {
            // use the object's own equals function, assuming it accepts an
            // object and returns a boolean
            if (!var1.equals(var2)) {
              failures.push('equals() returned false for ' +
                            (path || typeOfVar1));
            }
          } else if (var1.map_) {
            // assume goog.structs.Map or goog.structs.Set, where comparing
            // their private map_ field is sufficient
            innerAssert(var1.map_, var2.map_, childPath.replace('%s', 'map_'));
          } else {
            // else die, so user knows we can't do anything
            failures.push('unable to check ' + (path || typeOfVar1) +
                          ' for equality: it has an iterator we do not ' +
                          'know how to handle. please add an equals method');
          }
        }
      }
    } else {
      failures.push(path + ' expected ' + _displayStringForValue(var1) +
                    ' but was ' + _displayStringForValue(var2));
    }
  }

  innerAssert(expected, actual, '');
  return failures.length == 0 ? null :
      'Expected ' + _displayStringForValue(expected) + ' but was ' +
      _displayStringForValue(actual) + '\n   ' + failures.join('\n   ');
};

/*
function testFreebaseConstructor()
{
	var fb = new Freebase();
	assertEquals(fb.constructor, Freebase);
}
*/

function testTableDocumentConstructor()
{
	var name = 'Foobar';
	var cols = [{name: "foo", type: String},
		{name: "bar", type: Number}];
	var td = new TableDocument(name, cols);
	assertEquals(td.constructor, TableDocument);
	assertUndefined(td._id); // assigned on save
	assertEquals(td.name, name);
	assertEquals(td.columns, cols);
	
	var all_view = "function(doc) " +
		"{ " +
		"if (doc." + Freebase.TABLE_FIELD + " == '" + td.name + "') { " +
		"emit(doc._id, doc);" +
		"} " +
		"}";
	assertObjectEquals(td.views.all, {map: all_view});
}

function MockFreebase()
{
	com.qwirx.freebase.Freebase.call(this);
	this.objectStore = {};
}

goog.inherits(MockFreebase, com.qwirx.freebase.Freebase);

/*
MockFreebase.prototype.deepCopy =  function(object, opt_stringifier)
{
	return JSON.parse(JSON.stringify(object));
};
*/

MockFreebase.prototype.get = function(documentId, onSuccess, onError)
{
	return this.get_(documentId, /* auto instantiate */ true, onSuccess,
		onError);
};

/**
 * findAll calls the "all" view of the named design, (e.g.
 * /_design/Foo/view/all), extracts the objects returned from the results
 * and passes the array of objects (JSON documents) to the onSuccess callback.
 */
MockFreebase.prototype.findAll =  function(designName, onSuccess, onError)
{
	var results = this.get_('_design/' + designName + '/_view/all',
		/* auto instantiate */ true,
		function(results)
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

MockFreebase.prototype.listAll = function(fetchDocuments, onSuccess, onError)
{
	return this.get_('_all_docs' + (fetchDocuments ? '?include_docs=true' : ''),
		/* auto instantiate */ false, onSuccess, onError);
};

MockFreebase.prototype.view = function(designId, viewName, onSuccess, onError)
{
	return this.get_(designId + '/_view/' + viewName,
		/* auto instantiate */ false, onSuccess, onError);
};

function sortByProperty(name)
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
}

MockFreebase.prototype.get_ = function(uri, autoInstantiate, onSuccess,
	onError)
{
	onError = onError || this.defaultOnErrorHandler_;

	var viewIndex = uri.indexOf('/_view/');
	var emitted = [];
	var self = this;
	var mapFunction;
	var currentDocument;
	var emitDocs = false;
	var params = [];

	var uriAndParams = uri.split('?', 2);
	if (uriAndParams.length == 2)
	{
		uri = uriAndParams[0];
		params = uriAndParams[1].split('&');
	}
	
	for (var i = 0; i < params.length; i++)
	{
		if (params[i] == 'include_docs=true')
		{
			emitDocs = true;
		}
	}

	function emit(key, value)
	{
		var row = {
			id: currentDocument._id,
			key: key,
			value: value
		};

		if (autoInstantiate)
		{
			row.value = self.instantiateModel_(value);
		}
		
		if (emitDocs)
		{
			row.doc = currentDocument;
		}
		
		emitted.push(row);
	}

	var selector = function(o)
	{
		emitted = [];
		currentDocument = o;
		mapFunction(o);
		return emitted;
	}
	
	if (uri.indexOf('_design/') == 0 && viewIndex > 0)
	{
		var designName = uri.substring(0, viewIndex);
		var designDoc = JSON.parse(this.objectStore[designName].json);
		var viewName = uri.substring(viewIndex +
			'/_view/'.length);
		eval("mapFunction = " + designDoc.views[viewName].map);
	}
	else if (uri == '_all_docs')
	{
		mapFunction = function(o)
		{
			emit(o._id, o._rev);
		}
	}
	else if (uri in this.objectStore)
	{
		var object = JSON.parse(this.objectStore[uri].json);
		
		if (autoInstantiate)
		{
			object = this.instantiateModel_(object);
		}
		
		onSuccess(object);
		return;
	}
	else
	{
		throw new Error("unexpected URI: " + uri);
	}
	
	var foundRows = [];
	
	for (var i in this.objectStore)
	{
		var o = JSON.parse(this.objectStore[i].json);
		
		// views don't search design documents for some reason
		if (uri == '_all_docs' || o._id.indexOf('_design/') != 0)
		{
			var emitted = selector(o);
			// Don't copy the result because CouchDB doesn't. If you
			// (or map()) modifies the emitted objects, then you can 
			// expect weird results.
			foundRows = foundRows.concat(emitted);
		}
	}
	
	foundRows.sort(sortByProperty('key'));
	onSuccess({total_rows: foundRows.length, offset: 0, rows: foundRows});
};

MockFreebase.prototype.saveReal_ = function(object, onSuccess, onError)
{
	if (!object._id)
	{
		object._id = "mock_" + Math.random().toString().substring(2);
	}
	
	if (this.objectStore[object._id])
	{
		var oldRev = this.objectStore[object._id].revision;
		if (oldRev != object._rev)
		{
			throw new ConflictException(object, oldRev, object._rev);
		}
	}
	
	object._rev = Math.random().toString().substring(2);
	
	this.objectStore[object._id] = {
		revision: object._rev,
		json: JSON.stringify(goog.object.clone(object)),
		deleted: object._deleted || false,
	};
	
	onSuccess(object);
};

MockFreebase.prototype.createReal$_ = function(object, onSuccess, onError)
{
	if (object._id && this.objectStore[object._id] && 
		!this.objectStore[object._id].deleted)
	{
		onError(this, object,
			new com.qwirx.freebase.DuplicateException(object,
				this.objectStore[object._id]));
	}
	else
	{
		this.saveReal_(object, onSuccess, onError);
	}
};

MockFreebase.prototype.deleteReal_ = function(object, onSuccess, onError)
{
	if (object._id && this.objectStore[object._id])
	{
		object._deleted = true;
		this.saveReal_(object, onSuccess, onError);
	}
	else
	{
		onError(this, object,
			new com.qwirx.freebase.NonexistentException(object));
	}
};

MockFreebase.prototype.getDocumentId = function(document)
{
	return document._id;
};

MockFreebase.prototype.setDocumentId = function(document, newId)
{
	document._id = newId;
};

MockFreebase.prototype.attachEvent = function()
{
	// appears to be required by events.js line 232, but is
	// undocumented, and I don't think we need it anyway.
}

var mockFreebase;
var domContainer = goog.dom.createDom(goog.dom.TagName.DIV,
	{'style': 'background-color: #eee; width: 50%; float: right;'});
goog.dom.appendChild(document.body, domContainer);

function setUp()
{
	goog.dom.removeChildren(domContainer);
	
	mockFreebase = new MockFreebase();
	Cat = Model('Cat', mockFreebase, [{name: 'name', type: 'String'},
		{name: 'age', type: 'Number'}]);
	mockFreebase.create$(Cat, function(){});
	
	old = new Cat({name: "Old Deuteronomy", age: 82});
	mockFreebase.save(old, function(){});
	etc = new Cat({name: "Etcetera", age: 0});
	mockFreebase.save(etc, function(){});
}

/**
 * Pass a block of code that takes a callback function c as its only
 * parameter, and passes that to the async method. If c is not called,
 * the assertion fails. Note that it assumes that the async method
 * will call the callback synchronously, in the same thread, e.g.
 * because it has been mocked to do so! So it's not a fully async test.
 */
function assertCallback(f)
{
	var calledBack = false;
	var result;
	
	function c()
	{
		calledBack = true;
		result = arguments;
	}
	
	f(c);
	
	assertTrue("Callback was not called as expected", calledBack);
	return result;
}

function assertFreebaseApi(fb)
{
	var expected = '_design/Foobar';
	assertEquals(fb.getTableId('Foobar'), expected);
	assertEquals(fb.isTableId(expected), true);
	
	var test = Model('test', fb, []);
	
	// deleteDoc should throw an exception because it's not saved yet
	var exception = assertThrows("Database should reject deleting " +
		"an object that it doesn't contain",
		function() { fb.deleteDoc(test, function(){}); });
	goog.asserts.assertInstanceof(exception,
		com.qwirx.freebase.NonexistentException,
		"Wrong type of exception was thrown by attempting " +
		"to delete a nonexistent object");
	
	// test that Freebase.save() and Freebase.create() call the
	// callback with the ID of the saved document, not the whole
	// document.
	var result = assertCallback(function(c) { fb.save(test, c); })[0];
	assertObjectEquals(test, result);
	
	// deleteDoc does not really delete the document, but it sets its
	// _deleted flag, which we interpret as allowing us to recreate
	// the document.
	var result = assertCallback(function f(c) {fb.deleteDoc(test, c);})[0];
	assertTrue(result._deleted);
	var result = assertCallback(function f(c) {fb.get(test._id, c);})[0];
	assertTrue(result._deleted);
	
	result = assertCallback(function(c) { fb.create$(test, c); })[0];
	assertObjectEquals(test, result);
	assertCallback(function f(c) {fb.deleteDoc(test, c);});

	var expectedCatDoc = Cat.toDocument();
	var actualCatDoc = assertCallback(
		function(c) { fb.get(Cat.getId(), c); })[0];
	expectedCatDoc._rev = actualCatDoc._rev;
	expectedCatDoc = JSON.stringify(expectedCatDoc);
	actualCatDoc = JSON.stringify(actualCatDoc);
	assertEquals('The Cat Model should have been saved in the ' +
		'database by setUp()', expectedCatDoc, actualCatDoc);
	assertObjectEquals('The reconstructed Model class should be ' +
		'identical to the one that produced the Model Document',
		Cat, fb.app.models.Cat);

	var foo = {_id: 'foo', job: 'Foo'};
	var bar = {job: 'Bar'};
	var baz = {job: 'Basil'};
	var jobs = {
		_id: '_design/Jobs',
		views: {
			all:  {map: function(o) { if (o.job) { emit(o._id, o); } }.toString()},
			name: {map: function(o) { if (o.job) { emit(o.job, o); } }.toString()},
			foo:  {map: function(o) { if (o.job == 'Foo') { emit(null, o); } }.toString()},
			bar:  {map: function(o) { if (o.job == 'Bar') { emit(o._id, null); } }.toString()}
		}
	};
	
	assertCallback(function(c) { fb.create$(foo, c); });
	var exception = assertThrows('Database should reject saving a second copy ' +
		'of the document', function()
		{
			fb.create$(foo, function(){});
		});
	goog.asserts.assertInstanceof(exception,
		com.qwirx.freebase.DuplicateException,
		"Wrong type of exception was thrown by attempting " +
		"to create a duplicate object");

	assertCallback(function(c) { fb.create$(bar, c); })[0];
	assertCallback(function(c) { fb.create$(baz, c); })[0];
	var noNewModelsOnlyCat = {Cat: Cat};
	assertObjectEquals("Should not be any new app models at this point",
		noNewModelsOnlyCat, fb.app.models);
	assertCallback(function(c) { fb.create$(jobs, c); });
	assertObjectEquals("Should still be no models (jobs is not really a model)",
		noNewModelsOnlyCat, fb.app.models);
	assertObjectEquals(foo, 
		assertCallback(function(c) { fb.get(foo._id, c) })[0]);
	
	// returns all three objects, because jobs.views.map.all doesn't discriminate
	assertObjectEquals([foo, bar, baz].sort(sortByProperty('_id')),
		assertCallback(function(c) { fb.findAll('Jobs', c); })[0]);
	
	result = assertCallback(function(c) { fb.view(jobs._id, 'all', c); })[0];
	assertObjectEquals([
			{id: foo._id, key: foo._id, value: foo},
			{id: bar._id, key: bar._id, value: bar},
			{id: baz._id, key: baz._id, value: baz}
		].sort(sortByProperty('key')),
		result.rows);
	result = assertCallback(function(c) { fb.view(jobs._id, 'name', c); })[0];
	assertObjectEquals([
			{id: foo._id, key: foo.job, value: foo},
			{id: bar._id, key: bar.job, value: bar},
			{id: baz._id, key: baz.job, value: baz}
		].sort(sortByProperty('key')),
		result.rows);
	result = assertCallback(function(c) { fb.view(jobs._id, 'foo', c); })[0];
	assertObjectEquals([{id: foo._id, key: null, value: foo}],
		result.rows);
	result = assertCallback(function(c) { fb.view(jobs._id, 'bar', c); })[0];
	assertObjectEquals([{id: bar._id, key: bar._id, value: null}],
		result.rows);
}

function testMockFreebaseApi()
{
	var expectedCatDoc = Cat.toDocument();
	expectedCatDoc._rev = 
		mockFreebase.objectStore[Cat.getId()].revision;
	expectedCatDoc = JSON.stringify(expectedCatDoc);
	assertObjectEquals('The Cat Model should have been saved in the ' +
		'database by setUp()', expectedCatDoc, 
		mockFreebase.objectStore[Cat.getId()].json);

	assertFreebaseApi(mockFreebase);
}

function testBrowserCouchBaseApi()
{
	var bc = BrowserCouch("blarg", {
		storage: new BrowserCouch.FakeStorage()
		});
	var bcb = new com.qwirx.freebase.BrowserCouchBase(bc);
	assertCallback(function f(c) { bcb.create$(Cat, c); });

	/*	
	old = new Cat({name: "Old Deuteronomy", age: 82});
	assertCallback(function f(c) { fb.create$(old, c); });
	
	etc = new Cat({name: "Etcetera", age: 0});
	assertCallback(function f(c) { fb.create$(etc, c); });
	*/
	
	assertFreebaseApi(bcb);
}

function testModelBuilder()
{
	var name = 'Foobar';
	var cols = [{name: "foo", type: 'String'},
		{name: "bar", type: 'Number'}];
	
	var Foobar = Model(name, mockFreebase, cols);
	assertEquals(mockFreebase, Foobar.freebase);
	assertEquals(name, Foobar.modelName);
	assertObjectEquals(com.qwirx.freebase.ModelBase.findAll,
		Foobar.findAll);

	var results;
	function collectResults(r)
	{
		results = r;
	};
	
	// must save the model before calling findAll
	mockFreebase.create$(Foobar, function(){});
	Foobar.findAll({}, collectResults);
	assertObjectEquals([], results);
	
	var frob = new Foobar();
	assertEquals(undefined, frob._id);
	Foobar.findAll({}, collectResults);
	assertObjectEquals([], results);

	mockFreebase.save(frob, function(){});
	assertNotNull(frob._id);
	assertEquals("Foobar", frob[Freebase.TABLE_FIELD]);
	assertUndefined("toDocument should not be saved in the model object",
		frob.toDocument().toDocument);
	
	mockFreebase.findAll(Foobar.modelName, collectResults);
	assertObjectEquals("Database findAll method should instantiate each " +
		"result as a Model object", [frob], results);

	Foobar.findAll({}, collectResults);
	assertObjectEquals("Model findAll method should instantiate each " +
		"result as a Model object", [frob], results);

	var e = assertThrows('Database should reject saving a second copy ' +
		'of the model document', function()
		{
			mockFreebase.create$(Model(name, mockFreebase, cols),
				function(){});
		});

	/*
	Foobar.findFirst({}, collectResults);
	assertObjectEquals(frob, results);
	*/
}

function assertMessage(optional_comment, internal_details)
{
	if (optional_comment)
	{
		return optional_comment + " (" + internal_details + ")";
	}
	else
	{
		return internal_details;
	}
}

function assertTreeContents(tree, freebase, optional_comment)
{
	var ids = goog.object.getKeys(freebase.objectStore).sort();
	var len = ids.length;
	var objects = freebase.objectStore;
	var node;
	
	for (var i = 0; i < len; i++)
	{
		var id = ids[i];
		var object = objects[id];
		var node = tree.getChildAt(i);
		assertNotNull(assertMessage(optional_comment,
			"Item with ID " + id + " (index " + i + ") " +
			"missing from tree"), node);
		assertEquals(assertMessage(optional_comment,
			"Wrong label or different item in tree at index " + i),
			id, node.getText());
	}
	
	if (tree.hasChildren())
	{
		assertObjectEquals(assertMessage(optional_comment,
			"Unexpected children in tree from number " + len),
			[], tree.children_.slice(len));
	}
}

function testFreebaseGuiRun()
{
	var gui = new Freebase.Gui(mockFreebase);
	gui.run(domContainer);
	
	assertObjectEquals('Should be only one DocumentSaved listener now',
		[goog.events.getListener(mockFreebase,
			DocumentSaved.EVENT_TYPE, gui.onDocumentSaved, false, gui)],
		goog.events.listenerTree_[DocumentSaved.EVENT_TYPE][false][goog.getUid(mockFreebase)]);
	
	var i = new goog.dom.NodeIterator(domContainer);
	assertEquals(domContainer, i.next());
	assertEquals(gui.splitter_.getElement(), i.next());
	assertEquals(goog.ui.SplitPane.FIRST_CONTAINER_CLASS_NAME_,
		i.next().className);
	assertEquals(gui.navigator_.getElement(), i.next());
	i.skipTag();
	assertEquals(goog.ui.SplitPane.SECOND_CONTAINER_CLASS_NAME_,
		i.next().className);
	assertEquals(gui.editArea_.getElement(), i.next());
	i.skipTag();
	var e = assertThrows(i.next);
	assertEquals(goog.iter.StopIteration, e);
	
	assertEquals(goog.ui.tree.TreeControl, gui.navigator_.constructor);
	assertTrue(gui.navigator_ instanceof goog.ui.tree.TreeControl);	
	assertTreeContents(gui.navigator_, mockFreebase, "Tree should " +
		"have been initialised at construction to show the initial " +
		"database contents");
	
	assertEquals('age', etc.constructor.columns[1].name);
	var Badger = Model('Badger', mockFreebase,
		[{name: 'name', type: 'String'}, {name: 'set', type: 'Object'}]);
	assertEquals('Creating a new model should not change the columns ' +
		'of an existing model', 'age', etc.constructor.columns[1].name);

	var badgerDoc = Badger.toDocument();
	mockFreebase.create$(Badger, function(){}, fail);
	assertNotNull('Badger should be in the database after saving it',
		mockFreebase.objectStore[Badger.getId()]);
	assertTreeContents(gui.navigator_, mockFreebase, "Tree should have " +
		"been updated with the new model document, correctly sorted");

	mockFreebase.save(Badger, function(){});
	assertTreeContents(gui.navigator_, mockFreebase,
		'Save should not create a duplicate tree node');
	
	var catNode = gui.navigator_.getChildAt(1);
	assertEquals(Cat.getId(), catNode.getModel().id);
	assertObjectEquals({}, gui.openDocumentsById_);
	catNode.select();
	var editor = gui.getOpenDocumentsById(Cat.getId())[0];
	assertNotNull(editor);
	assertTrue(goog.style.isElementShown(editor.editorControl_));
	editor.close();
	assertObjectEquals({}, gui.openDocumentsById_);
	assertFalse('Editor grid should have been removed from the ' +
		'editor container on close',
		goog.dom.contains(gui.getEditorContainer(), editor.editorControl_));

	// open the badger document by selecting it from the tree	
	var badgerNode = gui.navigator_.getChildAt(0);
	assertEquals(Badger.getId(), badgerNode.getModel().id);
	badgerNode.select();
	var badgerEditor = gui.getOpenDocumentsById(Badger.getId())[0];
	assertEquals(badgerEditor.tab_, gui.editAreaDocTabs_.getSelectedTab());
	assertTrue(goog.style.isElementShown(badgerEditor.editorControl_));

	// open the cat document by selecting it from the tree, check that
	// the badger tab is no longer active and the document is hidden
	catNode.select();
	var catEditor = gui.getOpenDocumentsById(Cat.getId())[0];
	assertEquals(catEditor.tab_, gui.editAreaDocTabs_.getSelectedTab());
	assertEquals(Cat.getId(), catNode.getModel().id);
	assertFalse(goog.style.isElementShown(badgerEditor.editorControl_));
	assertTrue(goog.style.isElementShown(catEditor.editorControl_));
	
	// switch docs by opening badger again
	badgerNode.select();
	assertEquals(badgerEditor.tab_, gui.editAreaDocTabs_.getSelectedTab());
	assertTrue(goog.style.isElementShown(badgerEditor.editorControl_));
	assertFalse(goog.style.isElementShown(catEditor.editorControl_));
	
	badgerEditor.close(); // close inactive tab
	catEditor.close(); // close active tab
	assertObjectEquals({}, gui.openDocumentsById_);
	var expectedListeners = [goog.events.getListener(mockFreebase,
		DocumentSaved.EVENT_TYPE, gui.onDocumentSaved, false, gui)];
	goog.object.extend(expectedListeners,
		{locked_: 0, needsCleanup_: false});
	assertObjectEquals('Should be only one DocumentSaved listener now',
		expectedListeners,
		goog.events.listenerTree_[DocumentSaved.EVENT_TYPE][false][goog.getUid(mockFreebase)]);
	
	// open the Cat document, showing a list of Cats
	var editor = assertCallback(function(c)
		{ gui.openDocument(Cat.getId(), c); })[0];
	
	// create a few more cats
	var kit = new Cat({name: "Kitkat", age: 6});
	mockFreebase.save(kit, function(){});
	var mog = new Cat({name: "Moggy", age: 9});
	mockFreebase.save(mog, function(){});
	
	// should have been added to the tree automatically, sorted by ID
	var allCats = [old, etc, kit, mog];
	var allCatsMap = {};
	for (var i = 0; i < allCats.length; i++)
	{
		allCatsMap[allCats[i]._id] = allCats[i];
	}
	var allCatIds = goog.object.getKeys(allCatsMap).sort();
	
	for (var i = 0; i < allCatIds.length; i++)
	{
		assertEquals(allCatIds[i],
			gui.navigator_.getChildAt(2 + i).getModel().id);
	}

	// data grid should have been updated
	var ds = editor.getDataSource();
	assertEquals(4, ds.getRowCount());

	function assertDataSourceRow(rowIndex, modelObject)
	{
		var row = ds.getRow(rowIndex);
		assertEquals(modelObject._id,  row[0].value);
		assertEquals(modelObject.name, row[1].value);
		assertEquals("" + modelObject.age, row[2].value);
	}

	function assertAllCatsData()
	{	
		for (var i = 0; i < allCatIds.length; i++)
		{
			var expectedCat = allCatsMap[allCatIds[i]];
			assertDataSourceRow(i, expectedCat);
		}
	}		
	
	// happy birthday Etcetera! Who knows?
	etc.age = 1;
	mockFreebase.save(etc, function(){});
	assertAllCatsData();
	
	// close and reopen the Cat editor, check that it works when
	// documents already exist at open time
	editor.close();
	editor = assertCallback(function(c)	
		{ gui.openDocument(Cat.getId(), c); })[0];
	assertAllCatsData();
	
	// try opening a document
	editor.close();
	editor = assertCallback(function(c) { gui.openDocument(etc._id, c); })[0];
	assertEquals('fb-edit-area-doc-div fb-docedit-autoform',
		editor.editorControl_.className);
	var flash = editor.autoFormFlash_;
	assertFalse(flash.isVisible());
	var table = editor.autoFormTable_;
	assertEquals('fb-doc-auto', table.className);
	var rows = goog.dom.getChildren(table);
	assertEquals('_id',  goog.dom.getNodeAtOffset(rows[0], 1).data);
	assertEquals('_rev', goog.dom.getNodeAtOffset(rows[1], 1).data);
	assertEquals('age',  goog.dom.getNodeAtOffset(rows[2], 1).data);
	assertEquals('name', goog.dom.getNodeAtOffset(rows[3], 1).data);
	assertEquals(4, rows.length);
	
	// change document using the form, check that it's saved
	var controls = editor.autoFormControls_;
	controls.age.value = 2;
	controls.name.value = 'Anonymouse';
	editor.submitButton_.performActionInternal(); // trigger a click event
	assertEquals('Document saved.', editor.autoFormFlash_.getContent());
	assertTrue(editor.autoFormFlash_.isVisible());
	
	var etc2 = assertCallback(function(c) { mockFreebase.get(etc._id, c); })[0];
	assertEquals(2, etc2.age);
	assertEquals('Anonymouse', etc2.name);
	assertFalse(etc2._rev == etc._rev);
	assertEquals(etc2._rev, editor.autoFormControls_._rev.value);
	assertEquals(etc2._rev, goog.dom.getChildren(rows[1])[1].innerHTML);

	// modify again to check that the revision in the form was updated
	// properly
	controls.age.value = 3;
	controls.name.value = 'Sylvester';
	editor.submitButton_.performActionInternal(); // trigger a click event
	assertEquals('Document saved.', editor.autoFormFlash_.getContent());
	assertTrue(editor.autoFormFlash_.isVisible());
	
	etc2 = assertCallback(function(c) { mockFreebase.get(etc._id, c); })[0];
	assertEquals(3, etc2.age);
	assertEquals('Sylvester', etc2.name);
	assertFalse(etc2._rev == etc._rev);
	assertEquals(etc2._rev, editor.autoFormControls_._rev.value);
	assertEquals(etc2._rev, goog.dom.getChildren(rows[1])[1].innerHTML);
}

function getCell(grid, x, y)
{
	if (x == -1 && y == -1)
	{
		return undefined;
	}
	else
	{
		return grid.rows_[y].getColumns()[x].tableCell;
	}
}

function assertSelection(grid, message, x1, y1, x2, y2)
{
	// shortcut to avoid comparing origin, which is a DOM node that
	// leads to really deep comparisons!
	var expected = {x1: x1, y1: y1, x2: x2, y2: y2};
	var actual = goog.object.clone(grid.drag);
	goog.object.remove(actual, 'origin');
	assertObjectEquals(message, expected, actual);
	var scroll = grid.scrollOffset_;
	
	// check that row and column CSS classes match expectations
	for (var y = 0; y < grid.getVisibleRowCount(); y++)
	{
		var rowElement = grid.rows_[y].getRowElement();
		var dataRow = y + scroll.y;
		var shouldBeVisible = (dataRow < grid.dataSource_.getRowCount());
		
		assertEquals(message + ": wrong visible status for " +
			"grid row " + y + ", data row " + dataRow,
			shouldBeVisible, goog.style.isElementShown(rowElement));
		
		if (shouldBeVisible)
		{
			assertEquals(message + ": wrong highlight status for " +
				"grid row " + y + ", data row " + dataRow,
				/* should this row be highlighted? */
				dataRow >= Math.min(y1, y2) &&
				dataRow <= Math.max(y1, y2),
				/* is it actually highlighted? */
				goog.dom.classes.has(rowElement, 'highlight'));
		}		
	}

	var builder = new goog.string.StringBuffer();
	for (var x = Math.min(x1, x2); x <= Math.max(x1, x2) && x1 >= 0; x++)
	{
		builder.append('table#' + grid.dataTable_.id + ' > ' +
			'tr.highlight > td.col_' + x + ' { background: #ddf; }');
	}
	assertEquals(message, builder.toString(), grid.highlightStyles_.innerHTML);
}

function assertGetGrid()
{
	var gui = new Freebase.Gui(mockFreebase);
	gui.run(domContainer);

	var editor = assertCallback(function(c) { gui.openDocument(Cat.getId(), c); })[0];
	
	var grid = editor.grid_;
	assertEquals('Grid should have been populated with some cats',
		2, grid.getVisibleRowCount());
	assertSelection(grid, 'No cells should be selected initially',
		-1, -1, -1, -1);

	return grid;
}

function testGridHighlightModeCells()
{
	var grid = assertGetGrid();
	
	com.qwirx.test.FakeBrowserEvent.mouseMove(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should not have changed without click',
		-1, -1, -1, -1);

	com.qwirx.test.FakeBrowserEvent.mouseDown(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should have changed with click',
		0, 0, 0, 0);
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("mousedown should have set current row", 0,
		grid.getCursor().getPosition());
		
	// MOUSEOUT on a different cell is spurious and doesn't change mode
	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 1, 0));
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	
	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 0, 1));
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("Original cell should still be editable",
		"true", getCell(grid, 0, 0).contentEditable);

	// simulate MOUSEOUT to change the drag mode from TEXT to CELLS
	// this is the original starting cell, and leaving it does change mode
	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 0, 0));
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	assertEquals("Original cell should no longer be editable",
		"inherit", getCell(grid, 0, 0).contentEditable);

	// entry into another cell has no effect
	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 1));
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	
	// re-entry into starting cell switches mode back to TEXT
	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 0));
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	assertEquals(true, grid.isAllowTextSelection());
	assertEquals("Original cell should be editable again",
		"true", getCell(grid, 0, 0).contentEditable);

	// re-exit from starting cell switches mode back to CELLS
	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 0, 0));
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	assertEquals("Original cell should no longer be editable",
		"inherit", getCell(grid, 0, 0).contentEditable);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 1));
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 0, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 0));
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 1, 0);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should have changed with reentry to ' +
		'starting cell', 0, 0, 0, 0);

	// that will have switched the mode back to TEXT, and only
	// a mouseout will change it back
	assertEquals(com.qwirx.grid.Grid.DragMode.TEXT, grid.dragMode_);
	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 0, 0));
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 1));
	assertSelection(grid, 'Selection should have changed with drag',
		0, 0, 1, 1);

	// mouseup should enable text selection, even if it wasn't
	// enabled before, to allow keyboard selection afterwards
	assertEquals(com.qwirx.grid.Grid.DragMode.CELLS, grid.dragMode_);
	assertEquals(false, grid.isAllowTextSelection());
	com.qwirx.test.FakeBrowserEvent.mouseUp(getCell(grid, 0, 0));
	assertEquals(true, grid.isAllowTextSelection());
	// and set the selection mode back to NONE, so that future
	// mouse movement events don't cause selection changes
	assertEquals(com.qwirx.grid.Grid.DragMode.NONE, grid.dragMode_);
	// selection changes with mouseover, not mouseup
	assertSelection(grid, 'Selection should not have changed with mouseup',
		0, 0, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 2, 1));
	assertSelection(grid, 'Selection should not have changed without another mousedown',
		0, 0, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseDown(getCell(grid, 2, 1));
	assertSelection(grid, 'Selection should have changed with click',
		2, 1, 2, 1);
	assertEquals("mousedown should have set current row", 1,
		grid.getCursor().getPosition());

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 1));
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 0));
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 0);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 1, 1));
	assertSelection(grid, 'Selection should have changed with drag',
		2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOut(getCell(grid, 0, 1));
	assertSelection(grid, 'Selection should not have changed when mouse ' +
		'left the grid', 2, 1, 1, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 1));
	assertSelection(grid, 'Selection should still be changeable after mouse ' +
		'left the grid and reentered in a different place',
		2, 1, 0, 1);

	com.qwirx.test.FakeBrowserEvent.mouseUp(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should not have changed with mouseup',
		2, 1, 0, 1);
}

function testGridHighlightModeColumns()
{
	var grid = assertGetGrid();

	// test that the header row doesn't become editable when clicked,
	// that text selection is disabled, and the entire column is
	// highlighted.
	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.columns_[1].getIdentityNode());
	assertEquals(com.qwirx.grid.Grid.DragMode.COLUMNS,
		grid.dragMode_);
	assertSelection(grid, 'Selection should have changed with ' +
		'mousedown on header', 1, 0, 1, 1);
	assertEquals("Header node should never allow text selection",
		false, grid.isAllowTextSelection());
	assertEquals("Header node should never be editable",
		"inherit", grid.columns_[1].getIdentityNode().contentEditable);

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.columns_[2].getIdentityNode());
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on header', 1, 0, 2, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on body', 1, 0, 0, 1);

	com.qwirx.test.FakeBrowserEvent.mouseUp(getCell(grid, 2, 0));
	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 2, 1));
	assertSelection(grid, 'Selection should not have changed with ' +
		'mouseover on body after mouseup', 1, 0, 0, 1);
}

function testGridHighlightModeRows()
{
	var grid = assertGetGrid();

	// test that the header row doesn't become editable when clicked,
	// that text selection is disabled, and the entire column is
	// highlighted.
	com.qwirx.test.FakeBrowserEvent.mouseDown(grid.rows_[0].getIdentityNode());
	assertEquals(com.qwirx.grid.Grid.DragMode.ROWS,
		grid.dragMode_);
	assertSelection(grid, 'Selection should have changed with ' +
		'mousedown on header', 0, 0, 2, 0);
	assertEquals("Header node should never allow text selection",
		false, grid.isAllowTextSelection());
	assertEquals("Header node should never be editable",
		"inherit", grid.rows_[0].getIdentityNode().contentEditable);
	assertEquals("mousedown should have set current row", 0,
		grid.getCursor().getPosition());

	com.qwirx.test.FakeBrowserEvent.mouseOver(grid.rows_[1].getIdentityNode());
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on header', 0, 0, 2, 1);

	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 0, 0));
	assertSelection(grid, 'Selection should have changed with ' +
		'mouseover on body', 0, 0, 2, 0);

	com.qwirx.test.FakeBrowserEvent.mouseUp(getCell(grid, 2, 0));
	com.qwirx.test.FakeBrowserEvent.mouseOver(getCell(grid, 2, 1));
	assertSelection(grid, 'Selection should not have changed with ' +
		'mouseover on body after mouseup', 0, 0, 2, 0);
}

function testGridInsertRowAt()
{
	var gui = new Freebase.Gui(mockFreebase);
	gui.run(domContainer);
	var editor = assertCallback(function(c) { gui.openDocument(Cat.getId(), c); })[0];
	var grid = editor.grid_;
	assertEquals('Grid should have been populated with some cats',
		2, editor.getDataSource().getRowCount());
	
	// insert a row between two others
	editor.getDataSource().insertRow(1,
		[{value: "unidentified"}, {value: "flying"}, {value: "object"}]);
	assertEquals('Data source row count should have been updated',
		3, editor.getDataSource().getRowCount());
	
	var allCats = assertCallback(function(c)
		// { mockFreebase.listAll(true, c); })[0].rows;
		{ mockFreebase.findAll(Cat.modelName, c); })[0];
	
	var allCatsMap = {};
	for (var i = 0; i < allCats.length; i++)
	{
		allCatsMap[allCats[i]._id] = allCats[i];
	}
	var allCatIds = goog.object.getKeys(allCatsMap).sort();
	
	function assertCellContentsAndSelection(rowIndex, contents)
	{
		assertEquals(contents, grid.rows_[rowIndex].getColumns()[0].value);
		assertEquals(rowIndex, grid.rows_[rowIndex].getRowIndex());
		var cell = grid.rows_[rowIndex].getColumns()[0].tableCell;
		assertEquals(rowIndex,
			cell[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW].getRowIndex());
		com.qwirx.test.FakeBrowserEvent.mouseDown(cell);
		assertSelection(grid, 'Selection should have changed with mousedown',
			0, rowIndex, 0, rowIndex);
		assertEquals("mousedown should have set current row", rowIndex,
			grid.getCursor().getPosition());
	}
	
	assertCellContentsAndSelection(0, allCatIds[0]);
	assertCellContentsAndSelection(1, "unidentified");
	assertCellContentsAndSelection(2, allCatIds[1]);
}

function initGrid(datasource)
{
	// goog.style.setHeight(domContainer, 300);
	domContainer.style.height = '300px';
	domContainer.style.overflow = 'hidden';
	
	var grid = new com.qwirx.grid.NavigableGrid(datasource);
	grid.addClassName('fb-datagrid');
	grid.render(domContainer);

	// grid should initially display the top left corner
	assertObjectEquals({x: 0, y: 0}, grid.scrollOffset_);
	
	// grid container and scrolling container should fill the
	// available space
	assertEquals('100%', grid.getElement().style.height);
	
	// data div height + nav bar height should equal total height
	assertEquals(grid.getElement().clientHeight,
		grid.dataDiv_.clientHeight + grid.nav_.getElement().clientHeight);
	
	// grid should not have any rows outside the visible area
	// of the data div
	var rows = grid.dataTable_.children[0].children;
	var lastRow = rows[rows.length - 1];
	var container = grid.dataDiv_;
	var containerPos = goog.style.getPageOffset(container);
	var lastRowPos = goog.style.getPageOffset(lastRow);
	var remainingSpace = (containerPos.y + container.clientHeight) -
		(lastRowPos.y + lastRow.clientHeight);
	assertTrue(remainingSpace > 0);
	
	// a click which doesn't change the row selection should not
	// cause an error
	assertSelection(grid, "initial state should be no selection",
		-1, -1, -1, -1);
	
	return grid;
}

function assertGridContents(grid, data)
{
	self.assertEquals('Wrong number of rows in grid',
		data.length, grid.getVisibleRowCount());

	for (var rowIndex = 0; rowIndex < data.length; rowIndex++)
	{
		var rowData = data[rowIndex];
		for (var colIndex = 0; colIndex < rowData.length; colIndex++)
		{
			var cell = grid.rows_[rowIndex].getColumns()[colIndex].tableCell;
			self.assertEquals('Wrong value for row ' + rowIndex +
				' column ' + colIndex,
				rowData[colIndex].value.toString(), cell.innerHTML);
		}
	}
}

function testGridDataSourceEvents()
{
	var columns = [{caption: 'ID'}, {caption: 'Name'}];
	var data = [
		[{value: 1}, {value: 'John'}],
		[{value: 2}, {value: 'James'}],
		[{value: 5}, {value: 'Peter'}],
	];
	var ds = new com.qwirx.data.SimpleDatasource(columns, data);
	var grid = initGrid(ds);

	assertGridContents(grid, data);
	
	ds.appendRow([{value: 7}, {value: 'Paul'}]);
	data.push([{value: 7}, {value: 'Paul'}]);
	assertGridContents(grid, data);
	
	ds.insertRow(1, [{value: 8}, {value: 'Duke'}]);
	data.splice(1, 0, [{value: 8}, {value: 'Duke'}]);
	assertGridContents(grid, data);
	
	var oldValue = data[1][1].value;
	data[1][1].value = 'Atreides'
	self.assertNotEquals('The data source should contain a ' +
		'deep copy of the data, not affected by external changed',
		'Atreides', ds.getRow(1)[1].value);

	data[1][1] = {value: 'Leto'}
	self.assertNotEquals('The data source should contain a ' +
		'deep copy of the data, not affected by external changed',
		'Leto', ds.getRow(1)[1].value);
	data[1][1].value = oldValue;
	
	ds.updateRow(2, [{value: 9}, {value: 'Iago'}]);
	data.splice(2, 1, [{value: 9}, {value: 'Iago'}]);
	assertGridContents(grid, data);
}	

var TestDataSource = function()
{
	this.requestedRows = [];
	this.rowCount = 10000;
};

goog.inherits(TestDataSource, com.qwirx.data.Datasource);

// http://station.woj.com/2010/02/javascript-random-seed.html
function random(max, seed)
{
	if (!seed)
	{
		seed = new Date().getTime();
	}
	seed = (seed*9301+49297) % 233280;
	return seed % max;
}

TestDataSource.prototype.getRow = function(rowIndex)
{
	this.requestedRows.push(rowIndex);
	return [
		{value: "" + rowIndex},
		{value: "" + random(1000, rowIndex)}
	];
};

TestDataSource.prototype.getRowCount = function()
{
	return this.rowCount;
};

TestDataSource.prototype.setRowCount = function(newRowCount)
{
	this.rowCount = newRowCount;
	this.dispatchEvent(com.qwirx.data.Datasource.Events.ROW_COUNT_CHANGE);
};

TestDataSource.prototype.getColumns = function()
{
	return [{caption: 'Row Index'}, {caption: 'Random Number'}];
};

function testGridDataSource()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	assertEquals(ds, grid.getDatasource());
	assertEquals(ds, grid.getCursor().dataSource_);
}

function assertGridRowsVisible(grid, numRows)
{
	var len = grid.rows_.length;
	
	for (var i = 0; i < len; i++)
	{
		var visible = (i < numRows);
		assertEquals("Display style is wrong for row " + i +
			" with " + numRows + " total rows", visible ? '' : 'none',
			grid.rows_[i].getRowElement().style.display);
	}
}

function testGridRespondsToDataSourceRowCountChanges()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	ds.setRowCount(1);
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertObjectEquals({}, grid.drag);
	assertTrue("The following tests will fail unless at least " +
		"one row is visible",
		ds.getRowCount() < grid.getVisibleRowCount());
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals(0, grid.scrollOffset_.y);
	assertGridRowsVisible(grid, 1);

	ds.setRowCount(grid.getFullyVisibleRowCount() + 1);
	assertEquals("Grid with datasource with 1 row more available " +
		"than visible should allow scrolling by 1 row", 1,
		grid.scrollBar_.getMaximum());
	assertEquals("Grid after datasource row count change should " +
		"still be positioned at left column", 0, grid.scrollOffset_.x);
	assertEquals("Grid after datasource row count change should " +
		"still be positioned at top row", 0, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom, and in this case
	// 1 is at the top.
	assertEquals("After datasource row count change, grid scrollbar " +
		"value should have been adjusted to maintain offset from bottom",
		1, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, grid.getVisibleRowCount());
	
	grid.scrollBar_.setValue(0); // scrolled down by 1 row
	assertEquals("Change to vertical scrollbar value should not have " +
		"changed horizonal scroll offset", 0, grid.scrollOffset_.x);
	assertEquals("Change to vertical scrollbar value should have " +
		"changed vertical scroll offset from bottom", 1,
		grid.scrollOffset_.y);
	assertGridRowsVisible(grid, grid.getFullyVisibleRowCount());

	// Changing datasource row count so that grid has fewer rows
	// should not change position.
	ds.setRowCount(grid.getFullyVisibleRowCount());
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals(1, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should be out of sync " +
		"with the grid contents, because the original scroll " +
		"position is no longer valid", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, grid.getFullyVisibleRowCount() - 1);

	// Same with just one row visible.
	ds.setRowCount(grid.scrollOffset_.y + 1);
	assertEquals(1, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should still be out of sync " +
		"with the grid contents", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, 1);

	// Changing datasource row count so that no rows are visible
	// should however change position to keep at least one visible.
	ds.setRowCount(1);
	assertEquals(0, grid.scrollBar_.getMaximum());
	assertEquals(0, grid.scrollOffset_.x);
	assertEquals("Changing datasource row count so that no rows " +
		"are visible should have changed scroll position to keep " +
		"at least one row visible.", 0, grid.scrollOffset_.y);
	// Slider is inverted, so 0 is at the bottom.
	assertEquals("The vertical scrollbar should not be out of sync " +
		"with the grid contents any more", 0, grid.scrollBar_.getValue());
	assertGridRowsVisible(grid, 1);
}

/**
 * This test currently fails due to a bug in Closure, and is
 * therefore disabled:
 * {@see http://code.google.com/p/closure-library/issues/detail?id=521}
 */
/*
function testScrollBarBehaviour()
{
	var scroll = new goog.ui.Slider;
	scroll.setMaximum(10000);
	scroll.setValue(9998);
	assertEquals(0, scroll.getExtent());
	scroll.setMaximum(10);
	scroll.setValue(8);
	assertEquals(8, scroll.getValue());
	assertEquals(0, scroll.getExtent());
}
*/

function testGridScrollAndHighlight()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);
	
	function range(a, b)
	{
		var array = [];
		for (var i = 0; i <= (b - a); i++)
		{
			array[i] = a + i;
		}
		return array;
	}
	
	var gridRows = grid.getVisibleRowCount();
	assertObjectEquals(range(0, gridRows - 1), ds.requestedRows);
	
	var maxScroll = ds.getRowCount() - gridRows + 1;

	var scrollbar = grid.scrollBar_;
	assertNotNull(scrollbar);
	assertEquals('scrollbar has wrong minimum value', 0,
		scrollbar.getMinimum());
	assertEquals('scrollbar has wrong maximum value', maxScroll,
		scrollbar.getMaximum());
	// slider is inverted, so the maximum value is at the top
	assertEquals('scrollbar should be at maximum value (top)',
		scrollbar.getMaximum(), scrollbar.getValue());
	assertEquals(0, scrollbar.getExtent());

	ds.requestedRows = [];
	scrollbar.setValue(0); // slider is inverted, so 0 is at the bottom
	assertObjectEquals({x: 0, y: maxScroll},
		grid.scrollOffset_);
	assertObjectEquals(range(maxScroll,	ds.getRowCount() - 1),
		ds.requestedRows);
	
	grid.setSelection(1, 1, 2, 4);
	assertSelection(grid, "setSelection method should change selection",
		1, 1, 2, 4);

	ds.requestedRows = [];
	scrollbar.setValue(maxScroll - 2); // 2 from the top
	assertObjectEquals('wrong set of rows were loaded from datasource',
		range(2, gridRows + 1), ds.requestedRows);
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
	assertSelection(grid, "scrolling should not have changed selection",
		1, 1, 2, 4);

	// Shrink the row count a bit, check that scrollbar is adjusted
	grid.setSelection(1, 1, 2, 4);
	ds.requestedRows = [];
	ds.setRowCount(gridRows * 2); // but the first two are offscreen
	maxScroll = ds.getRowCount() - grid.getFullyVisibleRowCount();
	assertEquals("row count change should have reset scrollbar maximum",
		maxScroll, scrollbar.getMaximum());
	assertEquals("row count change should have adjusted scrollbar " +
		"value to maintain position 2 rows down from the top",
		scrollbar.getMaximum() - 2, scrollbar.getValue());
	assertObjectEquals(range(2, gridRows + 1), ds.requestedRows);
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
		
	// Shrink the row count to less than the selection, check that
	// scrollbar is adjusted (maximum should be 0) and selection
	// truncated to new row count.
	grid.setSelection(1, 1, 2, gridRows + 2);
	ds.requestedRows = [];
	
	// Test that setting datasource rows to fewer than visible rows
	// disables scrolling. It must be fewer, because the last row
	// may be only partially visible, so you might have to scroll
	// to see it.
	ds.setRowCount(gridRows - 1); // but the first two are offscreen
	assertEquals("row count change should have reset scrollbar " +
		"maximum to zero, as scrolling is no longer possible",
		0, scrollbar.getMaximum());
	assertEquals("row count change should have adjusted scrollbar " +
		"value to 0 to stay between minimum and maximum",
		0, scrollbar.getValue());
	assertSelection(grid, "shrinking datasource should have shrunk " +
		"selection", 1, 1, 2, gridRows - 2);
	
	// the grid scroll offset is left at 2, no longer matching the
	// scroll position, to avoid a visual jump
	assertObjectEquals({x: 0, y: 2}, grid.scrollOffset_);
	assertObjectEquals(range(2, gridRows - 2), ds.requestedRows);
	
	// but any attempt to set the value should cause the grid's
	// scroll offset to jump back to 0
	ds.requestedRows = [];
	grid.scrollBar_.dispatchEvent(goog.ui.Component.EventType.CHANGE);
	assertObjectEquals({x: 0, y: 0}, grid.scrollOffset_);
	assertObjectEquals(range(0, gridRows - 2), ds.requestedRows);	

	// reset for manual testing, playing and demos
	var dataRows = 10000;
	ds.setRowCount(dataRows);
	maxScroll = dataRows - grid.getFullyVisibleRowCount();
	
	// highlight the last row, scroll back to the top and simulate
	// a click. This used to try to unhighlight an HTML table row
	// element with a massive index, because scroll was not taken
	// into account.
	grid.setSelection(0, dataRows - 1, 1, dataRows - 1);

	assertEquals(maxScroll, scrollbar.getMaximum());
	scrollbar.setValue(maxScroll); // at the top
	assertEquals(maxScroll, scrollbar.getValue());
	
	var cell = grid.rows_[0].getColumns()[0].tableCell;
	assertEquals(0,
		cell[com.qwirx.grid.Grid.TD_ATTRIBUTE_ROW].getRowIndex());
	com.qwirx.test.FakeBrowserEvent.mouseDown(cell);
	assertSelection(grid, 'Selection should have changed with mousedown',
		0, 0, 0, 0);
	assertEquals("mousedown should have set current row", 0,
		grid.getCursor().getPosition());
}

function assertNavigateGrid(grid, startPosition, button,
	expectedPosition, expectedScroll, positionMessage, scrollMessage)
{
	grid.nav_.getCursor().setPosition(startPosition);
	assertEquals("starting position row number in Cursor",
		startPosition, grid.nav_.getCursor().getPosition());
	assertEquals("starting position text field contents",
		startPosition + "", grid.nav_.rowNumberField_.getValue());
	
	if (!scrollMessage)
	{
		var initialScroll = grid.scrollOffset_.y;
		if (initialScroll != expectedScroll)
		{
			scrollMessage = "selecting an offscreen record should " +
				"scroll until record is in view";
		}
		else
		{
			scrollMessage = "selecting an onscreen record should " +
				"not scroll";
		}
	}
	
	com.qwirx.test.FakeClickEvent.send(button.getElement());
	assertEquals(positionMessage, expectedPosition,
		grid.nav_.getCursor().getPosition());
	assertEquals(scrollMessage, expectedScroll, grid.scrollOffset_.y);
	assertEquals("final scroll bar position",
		grid.scrollBar_.getMaximum() - expectedScroll,
		grid.scrollBar_.getValue());

	// Check that the row highlighter has been updated
	var currentDataRowIndex = expectedPosition;
	var currentVisibleRowIndex = currentDataRowIndex - expectedScroll;
	var css;
	
	if (currentVisibleRowIndex >= 0 && 
		currentVisibleRowIndex < grid.rows_.length)
	{
		css = 'table#' + grid.dataTable_.id +
			' > tr#row_' + currentVisibleRowIndex + 
			' > th { background-color: #88f; }';
	}
	else
	{
		css = "";
	}	

	assertEquals(css, grid.currentRowStyle_.textContent);
}

function assertNavigationException(grid, startPosition, button, message)
{
	grid.nav_.getCursor().setPosition(startPosition);
	assertEquals(startPosition, grid.nav_.getCursor().getPosition());

	var exception = assertThrows(message, 
		function() { com.qwirx.test.FakeClickEvent.send(button); });
	goog.asserts.assertInstanceof(exception, com.qwirx.data.IllegalMove,
		message);
}

function testGridNavigation()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	var BOF = com.qwirx.data.Cursor.BOF;
	var EOF = com.qwirx.data.Cursor.EOF;
	var dataRows = ds.getRowCount();
	var gridRows = grid.getFullyVisibleRowCount();
	var maxScroll = dataRows - gridRows;
	var lastRecord = dataRows - 1;
	
	assertTrue("we will scroll unexpectedly if gridRows < 3, " +
		"breaking the tests", gridRows >= 3);
	/*
	assertFalse("toolbar should not be focusable, so it doesn't " +
		"steal focus from its buttons on bubble up",
		goog.dom.isFocusableTabIndex(grid.nav_.getElement()));
	*/

	assertEquals("cursor should be positioned at BOF initially",
		BOF, grid.nav_.getCursor().getPosition());

	// movements from BOF
	assertNavigateGrid(grid, BOF, grid.nav_.nextButton_, 0, 0,
		"next record from BOF");
	assertNavigateGrid(grid, BOF, grid.nav_.nextPageButton_, gridRows - 1,
		0, "next page from BOF takes us one less than a pageful down");
	assertNavigateGrid(grid, BOF, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from BOF");
	assertNavigationException(grid, BOF, grid.nav_.prevButton_,
		"previous record from BOF should throw exception");
	assertNavigationException(grid, BOF, grid.nav_.prevPageButton_,
		"previous record from BOF should throw exception");
	assertNavigateGrid(grid, BOF, grid.nav_.firstButton_, 0, 0,
		"first record from BOF");

	// movements from record 0
	assertNavigateGrid(grid, 0, grid.nav_.nextButton_, 1, 0,
		"next record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.nextPageButton_, gridRows,
		1, "next page from 0", "moving the selection down by a " +
		"pageful, and keeping the currently selected row visible, " +
		"requires the grid to scroll down by 1 row.");
	assertNavigateGrid(grid, 0, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.prevButton_, BOF, 0,
		"previous record from 0");
	assertNavigateGrid(grid, 0, grid.nav_.prevPageButton_, BOF, 0,
		"previous page from 0");
	assertNavigateGrid(grid, 0, grid.nav_.firstButton_, 0, 0,
		"first record from 0");

	// movements from record 1
	assertNavigateGrid(grid, 1, grid.nav_.nextButton_, 2, 0,
		"next record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.nextPageButton_, gridRows + 1,
		2, "next page from 0", "moving the selection down by a " +
		"pageful, and keeping the currently selected row visible, " +
		"requires the grid to scroll down by 2 rows.");
	assertNavigateGrid(grid, 1, grid.nav_.lastButton_, lastRecord,
		maxScroll, "last record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.prevButton_, 0, 0,
		"previous record from 1");
	assertNavigateGrid(grid, 1, grid.nav_.prevPageButton_, BOF, 0,
		"previous page from 1");
	assertNavigateGrid(grid, 1, grid.nav_.firstButton_, 0, 0,
		"first record from 1");
		
	// Movements from record gridRows-1 (second page of rows)
	grid.setScroll(0, gridRows-1);
	assertNavigateGrid(grid, gridRows-1, grid.nav_.prevPageButton_,
		BOF, 0, "previous page from gridRows-1");

	// Movements from record lastRecord-gridRows+1
	grid.setScroll(0, lastRecord-gridRows);
	assertNavigateGrid(grid, lastRecord-gridRows+1,
		grid.nav_.nextPageButton_, EOF, lastRecord-gridRows+1,
		"next page from lastRecord-gridRows+1");

	// movements from record lastRecord-1
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.nextButton_,
		lastRecord, maxScroll,
		"next record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.nextPageButton_,
		EOF, maxScroll, "next page from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.prevButton_,
		lastRecord - 2, maxScroll, "previous record from lastRecord-1");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.prevPageButton_,
		lastRecord - gridRows - 1, maxScroll - 2,
		"previous page from lastRecord-1",
		"should have to scroll up 2 rows to display newly active row");
	assertNavigateGrid(grid, lastRecord-1, grid.nav_.firstButton_, 0, 0,
		"first record from lastRecord-1");

	// movements from record lastRecord
	assertNavigateGrid(grid, lastRecord, grid.nav_.nextButton_,
		EOF, maxScroll, "next record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.nextPageButton_,
		EOF, maxScroll, "next page from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.prevButton_,
		lastRecord - 1, maxScroll, "previous record from lastRecord");
	assertNavigateGrid(grid, lastRecord, grid.nav_.prevPageButton_,
		lastRecord - gridRows, maxScroll - 1,
		"previous page from lastRecord",
		"should have to scroll up 1 row to display newly active row");
	assertNavigateGrid(grid, lastRecord, grid.nav_.firstButton_, 0, 0,
		"first record from lastRecord");

	// movements from EOF
	assertNavigationException(grid, EOF, grid.nav_.nextButton_,
		"next record from EOF");
	assertNavigationException(grid, EOF, grid.nav_.nextPageButton_,
		"next page from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.lastButton_,
		lastRecord, maxScroll, "last record from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.prevButton_,
		lastRecord, maxScroll, "previous record from EOF");
	assertNavigateGrid(grid, EOF, grid.nav_.prevPageButton_,
		lastRecord - gridRows + 1, maxScroll,
		"previous page from EOF",
		"should not have to scroll to display newly active row");
	assertNavigateGrid(grid, EOF, grid.nav_.firstButton_, 0, 0,
		"first record from EOF");
}

/**
 * It's not enough for the grid navigation buttons to listen for
 * onClick events; they must also intercept mouse events to avoid
 * them being sent to the grid, where they will cause all kinds of
 * trouble.
 */
function testGridNavigationButtonsInterceptMouseEvents()
{
	var ds = new TestDataSource();
	var grid = initGrid(ds);

	var buttons = [false, // included to ensure initial conditions
		grid.nav_.firstButton_,
		grid.nav_.prevPageButton_,
		grid.nav_.prevButton_,
		grid.nav_.nextButton_,
		grid.nav_.nextPageButton_,
		grid.nav_.lastButton_];

	// Patch the grid control to intercept mouseDown and mouseUp
	// events, which should be intercepted before they reach it.
	function f(e)
	{
		fail(e.type + " event propagation should be stopped " +
			"before reaching the Grid");
	}
	
	var handler = grid.getHandler();
	var element = grid.getElement();
	handler.listen(element, goog.events.EventType.MOUSEDOWN, f);
	handler.listen(element, goog.events.EventType.MOUSEUP, f);
	
	for (var i = 0; i < buttons.length; i++)
	{
		var button = buttons[i];
		
		if (button == false)
		{
			// test initial conditions
		}
		else
		{
			try
			{
				com.qwirx.test.FakeBrowserEvent.mouseDown(button.getElement());
				com.qwirx.test.FakeBrowserEvent.mouseUp(button.getElement());
			}
			catch (e)
			{
				if (e instanceof com.qwirx.data.IllegalMove)
				{
					// ignore the exception
				}
				else
				{
					throw e;
				}
			}
		}
		
		var buttonName = (button ? button.getContent() : "no");
		assertSelection(grid, "should be no selection",
			-1, -1, -1, -1);
		// MOUSEUP does actually trigger an action, so it will
		// move the cursor, so we can't test this:
		/*
		assertEquals("cursor should not have moved on " +
			buttonName + " button click", com.qwirx.data.Cursor.BOF,
			grid.getCursor().getPosition());
		assertEquals("grid should not have scrolled on " +
			buttonName + " button click", 0, grid.scrollOffset_.y);
		*/
	}
}	

function testBrowserCouchBase()
{
	var MockBrowserCouch = function()
	{
		this.objectStore = {};
	};

	MockBrowserCouch.prototype.get = function(id, onSuccess, onError)
	{
		if (id in this.objectStore)
		{
			var object = JSON.parse(this.objectStore[uri].json);
			onSuccess(object);
		}
		else
		{
			onError();
		}
	};
	
	bc = new MockBrowserCouch();
	bcb = new com.qwirx.freebase.BrowserCouchBase(bc);
	fb = new com.qwirx.freebase.Freebase(bcb);
}

/*
function testEditModelDesign()
{
	var gui = new Freebase.Gui(mockFreebase);
	gui.run(domContainer);
	var editor = assertCallback(function(c)
		{
			gui.openDocument(Cat.getId(), c, null, );
		})[0];
	var grid = editor.grid_;
	assertEquals('Grid should have been populated with some cats',
		2, editor.getDataSource().getRowCount());
	
}
*/