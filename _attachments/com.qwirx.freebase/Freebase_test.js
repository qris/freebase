goog.provide('com.qwirx.freebase.Freebase_test');

goog.require('com.qwirx.freebase.BrowserCouch');
goog.require('com.qwirx.freebase.BrowserCouchBase');
goog.require('com.qwirx.freebase.DuplicateException');
goog.require('com.qwirx.freebase.ConflictException');
goog.require('com.qwirx.freebase.Freebase');
goog.require('com.qwirx.freebase.Freebase.Gui');
goog.require('com.qwirx.freebase.Model');
goog.require('com.qwirx.freebase.NonexistentException');
goog.require('com.qwirx.grid.NavigableGrid');
goog.require('com.qwirx.test.FakeBrowserEvent');
goog.require('com.qwirx.test.FakeClickEvent');
goog.require('com.qwirx.test.assertThrows');
goog.require('com.qwirx.test.findDifferences');

goog.require('goog.dom.NodeIterator');
goog.require('goog.testing.jsunit');

function MockFreebase()
{
	com.qwirx.freebase.Freebase.call(this);
	this.objectStore = {};
}

goog.inherits(MockFreebase, com.qwirx.freebase.Freebase);

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

/**
 * listAll calls the "_all_docs" view, which extracts the _id and
 * _rev of all documents in the database, optionally including the
 * documents themselves (if fetchDocuments is true) and passes the
 * array of objects to the onSuccess callback.
 */
MockFreebase.prototype.listAll = function(fetchDocuments, onSuccess,
	onError)
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
		// Note: unlike objects, views in CouchDB do apparently
		// use "id" and not "_id" in their results, so don't change
		// this again.
		
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
		onError.call(this,
			new com.qwirx.freebase.DuplicateException(object,
				this.objectStore[object._id]),
			object);
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
		onError.call(this,
			new com.qwirx.freebase.NonexistentException(object),
			object);
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
	// import Freebase, TableDocument and other classes
	com.qwirx.freebase.import(this, com.qwirx.freebase);

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
	com.qwirx.test.assertThrows(com.qwirx.freebase.NonexistentException,
		function(){ fb.deleteDoc(test, function(){}); },
		"Database should reject deleting an object that it " +
		"doesn't contain");
	
	// test that Freebase.save() and Freebase.create() call the
	// callback with an array of updated document objects.
	var result = assertCallback(function(c) { fb.create$(test, c); })[0];
	assertObjectEquals([test], result);

	// create$ for a document that already exists should throw an error
	com.qwirx.test.assertThrows(com.qwirx.freebase.DuplicateException,
		function(){ fb.create$(test, function(){}) },
		'Database should reject saving a second copy of the document');

	// But save() should not.
	result = assertCallback(function(c) { fb.save(test, c); })[0];
	assertObjectEquals([test], result);

	// deleteDoc does not really delete the document, but it sets its
	// _deleted flag, which we interpret as allowing us to recreate
	// the document.
	result = assertCallback(function f(c) {fb.deleteDoc(test, c);})[0];
	assertTrue(result._deleted);
	result = assertCallback(function f(c) {fb.get(test._id, c);})[0];
	assertTrue(result._deleted);
	
	// So because the existing object is deleted, create$() does
	// not fail this time.
	result = assertCallback(function(c) { fb.create$(test, c); })[0];
	assertObjectEquals([test], result);
	result = assertCallback(function f(c) {fb.deleteDoc(test, c);})[0];
	test = result;

	assertCallback(function f(c) { fb.create$(Cat, c); });
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
	var Job = {
		_id: '_design/Job',
		views: {
			all:  {map: function(o) { if (o.job) { emit(o._id, o); } }.toString()},
			name: {map: function(o) { if (o.job) { emit(o.job, o); } }.toString()},
			foo:  {map: function(o) { if (o.job == 'Foo') { emit(null, o); } }.toString()},
			bar:  {map: function(o) { if (o.job == 'Bar') { emit(o._id, null); } }.toString()}
		}
	};
	
	assertCallback(function(c) { fb.create$(foo, c); });
	assertCallback(function(c) { fb.create$(bar, c); });
	assertCallback(function(c) { fb.create$(baz, c); });
	var noNewModelsOnlyCat = {'Cat': Cat};
	assertObjectEquals("Should not be any new app models at this point",
		noNewModelsOnlyCat, fb.app.models);
	assertCallback(function(c) { fb.create$(Job, c); });
	assertObjectEquals("Should still be no models (Job is not really a model)",
		noNewModelsOnlyCat, fb.app.models);
	var foo2 = assertCallback(function(c) { fb.get(foo._id, c) })[0];
	assertObjectEquals(foo, foo2);

	// Getting a model instance should instantiate the model class
	// automatically.
	result = assertCallback(function(c) { fb.create$(etc, c); })[0][0];
	assertObjectEquals(etc, result);
	var etc2 = assertCallback(function(c) { fb.get(etc._id, c); })[0];
	goog.asserts.assertInstanceof(etc2, fb.app.models.Cat);
	goog.asserts.assertInstanceof(etc2, com.qwirx.freebase.ModelBase);
	assertObjectEquals(etc, etc2);
	
	// But getting something that's not a model should just return
	// a plain object.
	assertFalse(foo2 instanceof com.qwirx.freebase.ModelBase);
	assertEquals("Object", foo2.constructor.name);
	
	// returns all three objects, because Job.views.map.all doesn't discriminate
	var jobs = [foo, bar, baz];
	assertObjectEquals(jobs.sort(sortByProperty('_id')),
		assertCallback(function(c) { fb.findAll('Job', c); })[0]);

	// Test that listAll returns the expected results
	var expected_docs_in_db = [test, Job, Cat, foo, bar, baz, etc];
	var expected_listAll_results = [];
	for (var i = 0; i < expected_docs_in_db.length; i++)
	{
		var row = {
			id: expected_docs_in_db[i]._id,
			key: expected_docs_in_db[i]._id,
			value: expected_docs_in_db[i]._rev
		};
		expected_listAll_results.push(row);
	}
	expected_listAll_results.sort(sortByProperty('id'));
	var actual_listAll_results = assertCallback(function(c)
		{ fb.listAll(false, c); })[0].rows;
	assertObjectEquals(expected_listAll_results,
		actual_listAll_results);
	
	// Test that listAll(true) includes the documents
	// assertEquals(Cat._id, actual_listAll_results[0]._id);
	var catIndex = null;
	for (i = 0; i < expected_listAll_results.length; i++)
	{
		if (expected_listAll_results[i].id == Cat._id)
		{
			catIndex = i;
			break;
		}
	}
	assertNotNull("Cat not found in list", catIndex);
	var actual_listAll_results = assertCallback(function(c)
		{ fb.listAll(true, c); })[0].rows;
	assertObjectEquals(Cat.toDocument(),
		actual_listAll_results[catIndex].doc);
	
	// Note: unlike objects, views in CouchDB do apparently
	// use "id" and not "_id" in their results, so don't change
	// this again.
	result = assertCallback(function(c) { fb.view(Job._id, 'all', c); })[0];
	assertObjectEquals([
			{id: foo._id, key: foo._id, value: foo},
			{id: bar._id, key: bar._id, value: bar},
			{id: baz._id, key: baz._id, value: baz}
		].sort(sortByProperty('key')),
		result.rows);
	result = assertCallback(function(c) { fb.view(Job._id, 'name', c); })[0];
	assertObjectEquals([
			{id: foo._id, key: foo.job, value: foo},
			{id: bar._id, key: bar.job, value: bar},
			{id: baz._id, key: baz.job, value: baz}
		].sort(sortByProperty('key')),
		result.rows);
	result = assertCallback(function(c) { fb.view(Job._id, 'foo', c); })[0];
	assertObjectEquals([{id: foo._id, key: null, value: foo}],
		result.rows);
	result = assertCallback(function(c) { fb.view(Job._id, 'bar', c); })[0];
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

	assertFreebaseApi(new MockFreebase());
}

function testBrowserCouchBaseApi()
{
	var bc = new com.qwirx.freebase.BrowserCouch.BrowserDatabase("blarg",
		{
			storage: new com.qwirx.freebase.BrowserCouch.FakeStorage()
		});
	var bcb = new com.qwirx.freebase.BrowserCouchBase(bc);
	
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
	
	// create a few more cats, testing array save at the same time
	var kit = new Cat({name: "Kitkat", age: 6});
	var mog = new Cat({name: "Moggy", age: 9});
	assertCallback(function(c){ mockFreebase.save([kit, mog], c); });
	assertNotUndefined("Cat should have been assigned an ID by save()",
		kit._id);
	assertNotUndefined("Cat should have been assigned an ID by save()",
		mog._id);
	
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
	assertEquals(4, ds.getCount());

	function assertDataSourceRow(rowIndex, modelObject)
	{
		var row = ds.get(rowIndex);
		assertEquals(modelObject._id,  row._id);
		assertEquals(modelObject.name, row.name);
		assertEquals(modelObject.age, row.age);
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

function assertSelection(grid, message, x1, y1, x2, y2)
{
	// shortcut to avoid comparing origin, which is a DOM node that
	// leads to really deep comparisons!
	var expected = {x1: x1, y1: y1, x2: x2, y2: y2};
	var actual = goog.object.clone(grid.drag);
	goog.object.remove(actual, 'origin');
	assertObjectEquals(message, expected, actual);
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

function testGridInsertRowAt()
{
	var gui = new Freebase.Gui(mockFreebase);
	gui.run(domContainer);
	var editor = assertCallback(function(c)
		{ gui.openDocument(Cat.getId(), c); })[0];
	var grid = editor.grid_;
	assertEquals('Grid should have been populated with some cats',
		2, editor.getDataSource().getCount());
	
	// insert a row between two others
	editor.getDataSource().insert(1, {_id: 'unidentified',
		name: 'flying', age: 'object'});
	assertEquals('Data source row count should have been updated',
		3, editor.getDataSource().getCount());
	
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
		assertEquals("Wrong contents in grid cell ("+rowIndex+",0)",
			contents, grid.rows_[rowIndex].getColumns()[0].text);
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
			onError.call(this, new Error("Document not found: " + id));
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
		2, editor.getDataSource().getCount());
	
}
*/
