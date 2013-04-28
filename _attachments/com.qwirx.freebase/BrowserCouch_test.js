goog.provide('com.qwirx.freebase.BrowserCouch_test');

goog.require('com.qwirx.freebase.BrowserCouch');
goog.require('com.qwirx.test.assertThrows');
goog.require('goog.testing.jsunit');
goog.require('goog.asserts');
goog.require('goog.net.XhrIo');

var mocked;

function setUp()
{
	mocked = {};
	named_capturing_callback.name = undefined;
	named_capturing_callback.count = 0;
	named_capturing_callback.args = undefined;
}

function tearDown()
{
	var current, prev, next_name;
	
	for (var path in mocked)
	{
		current = window;
		var components = path.split('.');
		for (var i = 0; i < components.length; i++)
		{
			next_name = components[i];
			prev = current;
			current = current[next_name] = current[next_name] || {};
		}

		prev[next_name] = mocked[name];
	}
}

function assert_support_extends(support)
{
	var foo = {
		'bar': 'baz'
	};
	var extra1 = {
		'baz': 'whee'
	};
	var extra2 = {
		'bonk': 'whee'
	};
	support.extend(foo, extra1, extra2);
	assertObjectEquals({
		'bar': 'baz',
		'baz': 'whee',
		'bonk': 'whee'
	}, foo);
}

function named_capturing_callback(name)
{
	return function(/* var_args */)
	{
		named_capturing_callback.last_called = name;
		named_capturing_callback.count++;
		named_capturing_callback.args = arguments;
	};
}

function preserve_and_mock(path, mock)
{
	var components = path.split('.');
	var current = window;
	var prev, next_name;
	for (var i = 0; i < components.length; i++)
	{
		next_name = components[i];
		prev = current;
		current = current[next_name] = current[next_name] || {};
	}
	
	mocked[path] = prev[next_name];
	prev[next_name] = mock;
}

function assert_support_getjson(support)
{
	var xhrs = [];
	preserve_and_mock('goog.net.XhrIo',
		function(url, opt_method, opt_content,
			opt_headers)
	{
		this.url = url;
		this.method = opt_method;
		this.content = opt_content;
		this.headers = opt_headers;
		xhrs.push(this);
	});
	goog.net.XhrIo.prototype.setTimeoutInterval = function(timeout)
	{
		this.timeout = timeout;
	};
	goog.net.XhrIo.prototype.setWithCredentials = function(withCredentials)
	{
		this.withCredentials = withCredentials;
	};
	goog.net.XhrIo.sendInstances_ = [];
	goog.net.XhrIo.CONTENT_TYPE_HEADER = "content-type";
	goog.net.XhrIo.prototype.send = function(url, opt_method,
		opt_content, opt_headers)
	{
		this.url = url;
		this.method = opt_method;
		this.content = opt_content;
		this.headers = opt_headers;
	};
	
	preserve_and_mock('goog.net.EventType.COMPLETE', 'COMPLETE');
	preserve_and_mock('goog.net.EventType.READY', 'READY');
	preserve_and_mock('goog.net.EventType.ERROR', 'ERROR');
	
	var listeners = [];
	preserve_and_mock('goog.events.listen',
		function(src, type, listener, opt_capt, opt_handler)
	{
		listeners.push({
			'src': src,
			'type': type,
			'listener': listener,
			'capt': opt_capt,
			'handler': opt_handler
		});
	});
	
	support.getJSON('http://www.example.com/foo/baz');
	
	assertEquals(1, xhrs.length);
	var xhr = xhrs[0];
	assertEquals('http://www.example.com/foo/baz', xhr.url);
	assertUndefined(xhr.headers);
	assertUndefined(xhr.content);
	assertUndefined(xhr.timeout);
	assertUndefined(xhr.withCredentials);
	assertEquals(0, named_capturing_callback.count);
	
	xhrs = [];
	listeners = [];
	
	support.getJSON('http://www.example.com/foo/bar',
		{
		'data': {'something': 'different'},
		'headers': {'X-Seen': 'NotYet'},
		'success': named_capturing_callback('success'),
		'error': named_capturing_callback('error'),
		'method': 'WHEE',
		'timeout': 1234,
		'xhrFields': {'withCredentials': true},
		'contentType': 'application/foobar',
		});

	assertEquals(1, xhrs.length);
	xhr = xhrs[0];
	assertEquals('http://www.example.com/foo/bar', xhr.url);
	assertObjectEquals("options.contentType should set the " +
		"Content-Type header",
		{'X-Seen': 'NotYet', 'content-type': 'application/foobar'},
		xhr.headers);
	assertObjectEquals({'something': 'different'}, xhr.content);
	assertEquals(1234, xhr.timeout);
	assertEquals(true, xhr.withCredentials);
	assertEquals(0, named_capturing_callback.count);
	
	/*
	for (var i = 0; i < listeners.length; i++)
	{
		if (listeners[i].src == xhr &&
			listeners[i].type == goog.net.EventType.COMPLETE)
		{
			listeners[i].listener({
				target: {
					getResponseJson: function()
					{
						return {dogen: 'whee'};
					}
				}
			});
		}
	}
	
	assertEquals('success', named_capturing_callback.name);
	assertEquals("getJSON didn't call the success callback function",
		1, named_capturing_callback.count);
	assertObjectEquals("getJSON passed the wrong argument to the " +
		"success callback function", [{dogen: 'whee'}],
		named_capturing_callback.args);
	*/
	
	assertTrue("getJSON didn't create enough event listeners",
		listeners.length >= 1);
	var listener = listeners[0];
	assertEquals(xhr, listener.src);
	assertEquals(goog.net.EventType.COMPLETE, listener.type);
	listener.listener({'target': 
		{'getResponseJson': function(){ return {'foo': 'bar'}; }}});
	assertEquals("getJSON didn't call the success callback function",
		1, named_capturing_callback.count);
	assertEquals('success', named_capturing_callback.last_called);
	assertObjectEquals("getJSON passed the wrong argument to the " +
		"success callback function", {foo: 'bar'},
		named_capturing_callback.args[0]);

	assertTrue("getJSON didn't create enough event listeners",
		listeners.length >= 3);
	listener = listeners[2];
	assertEquals(xhr, listener.src);
	assertEquals(goog.net.EventType.ERROR, listener.type);
	listener.listener();
	assertEquals(2, named_capturing_callback.count);
	assertEquals('error', named_capturing_callback.last_called);
};

function assert_support(support)
{
	assert_support_extends(support);
	assert_support_getjson(support);
}

function test_closure_support()
{
	var support = new com.qwirx.freebase.BrowserCouch.ClosureSupport();
	assert_support(support);
}

function test_samedomaindb_default_support()
{
	var sdd = new com.qwirx.freebase.BrowserCouch.SameDomainDB();
	goog.asserts.assertInstanceof(sdd.support,
		com.qwirx.freebase.BrowserCouch.ClosureSupport);
}

function test_samedomaindb_custom_support()
{
	var support = {getJSON: named_capturing_callback('getJSON')};
	
	var sdd = new com.qwirx.freebase.BrowserCouch.SameDomainDB("test",
		'http://www.example.com/couch', {support: support});
	assertEquals("Should be able to construct a BrowserCouch " +
		"using our own support object", support, sdd.support);
	var callbacks = {count: 0};
	var cb = 'CALLBACK';
	sdd.get('foobar', cb);
	assertEquals(1, named_capturing_callback.count);
	assertEquals(2, named_capturing_callback.args.length);
	assertEquals('http://www.example.com/couch/foobar',
		named_capturing_callback.args[0]);
	assertObjectEquals({success: cb} /* sdd.get() argument 1 */,
		named_capturing_callback.args[1]);
}

// Adapted from browsercouch/html/js/tests.js

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ubiquity.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// == The Suite ==
//
// The {{{Tests}}} namespace contains the actual testing suite for
// BrowserCouch.

var BrowserCouch = com.qwirx.freebase.BrowserCouch;
var BrowserCouchClass;

try
{
	var baseUrl = window.location.protocol + "//" + window.location.host;
	goog.net.XhrIo.send(baseUrl + "/", function(event)
		{
			var xhrio = event.target;
			var options = {};
				
			if (xhrio.getResponseHeader('Server').indexOf('CouchDB') == 0)
			{
				BrowserCouchClass = function(name, options)
				{
					BrowserCouch.SameDomainDB.call(this, name,
						baseUrl + '/' + name, options);
				}
			}
			else
			{
				BrowserCouchClass = com.qwirx.freebase.BrowserCouch.BrowserDatabase;
			}
		});
}
catch (e)
{
	BrowserCouchClass = com.qwirx.freebase.BrowserCouch.BrowserDatabase;
}

function testDictionary()
{
	var dict = new BrowserCouch.Dictionary();
	dict.set('foo', {a: 'hello'});
	dict.set('bar', {b: 'goodbye'});
	self.assertEqual(dict.get('foo').a, 'hello');
	self.assertEqual(dict.get('bar').b, 'goodbye');
	self.assertEqual(dict.getKeys().length, 2);
	self.assertEqual(dict.has('foo'), true);
	self.assertEqual(dict.has('bar'), true);
	self.assertEqual(dict.has('spatula'), false);
	dict.remove('bar');
	self.assertEqual(dict.getKeys().length, 1);
	self.assertEqual(dict.has('foo'), true);
};

var testDbContents = [
	{_id: "monkey", content: "hello there dude"},
	{_id: "chunky", content: "hello there dogen"}
];

function _setupTestDb(callback)
{
	var documents = testDbContents;
	
	var db = new BrowserCouchClass("blarg",
		{storage: new BrowserCouch.FakeStorage()});
	db.onload(function()
	{
		db.wipe(function()
		{
			db.put(documents,
				function()
				{
					BrowserCouch.ModuleLoader.require(
						"JSON",
						function() { callback(db); }
					);
				}
			);
		});
	});
}

function _mapWordFrequencies(doc, emit)
{
	var words = doc.content.split(" ");
	for (var i = 0; i < words.length; i++)
		emit(words[i], 1);
};

function _reduceWordFrequencies(keys, values)
{
	var sum = 0;
	for (var i = 0; i < values.length; i++)
		sum += values[i];
	return sum;
}

var self = this; // minimise code changes from original test suite

assertEqual = assertEquals;

/**
 * Fake stub to keep the original tests happy.
 */
function done()
{
}

function testViewMap_async()
{
	var map = this._mapWordFrequencies;
	this._setupTestDb(function(db)
	{
		db.view(
		{
			map: map,
			finished: function(result)
			{
				var expected = {
					rows:[{"_id":"chunky","key":"dogen","value":1},
						 {"_id":"monkey","key":"dude","value":1},
						 {"_id":"chunky","key":"hello","value":1},
						 {"_id":"monkey","key":"hello","value":1},
						 {"_id":"chunky","key":"there","value":1},
						 {"_id":"monkey","key":"there","value":1}]
				};
				self.assertEqual(JSON.stringify(expected.rows),
					JSON.stringify(result.rows));
				self.done();
			}
		});
	});
}

function testViewMapFindRow_async()
{
    var map = this._mapWordFrequencies;
    this._setupTestDb(function(db)
    {
		db.view(
		{
			map: map,
			finished: function(view)
			{
				self.assertEqual(view.findRow("dogen"), 0);
				self.assertEqual(view.findRow("dude"), 1);
				self.assertEqual(view.findRow("hello"), 2);
				self.assertEqual(view.findRow("there"), 4);
				self.done();
			}
		});
	});
}

function testViewProgress_async()
{
	var map = this._mapWordFrequencies;
	var reduce = this._reduceWordFrequencies;
	this._setupTestDb(function(db)
	{
		var progressCalled = false;
		var timesProgressCalled = 0;
		db.view(
		{
			map: map,
			reduce: reduce,
			chunkSize: 1,
			progress: function(phase, percentDone, resume)
			{
				if (phase == "map")
				{
					self.assertEqual(percentDone, 0.5);
					progressCalled = true;
				}
				resume();
			},
			finished: function(result)
			{
				self.assertEqual(progressCalled, true);
				self.done();
			}
		});
	});
}

function testViewMapReduceFindRow_async()
{
	var map = this._mapWordFrequencies;
	var reduce = this._reduceWordFrequencies;
	this._setupTestDb(function(db)
	{
		db.view(
		{
			map: map,
			reduce: reduce,
			finished: function(view)
			{
				self.assertEqual(view.findRow("dogen"), 0);
				self.assertEqual(view.findRow("dude"), 1);
				self.assertEqual(view.findRow("hello"), 2);
				self.assertEqual(view.findRow("there"), 3);
				self.done();
			}
		});
	});
}

function testViewMapReduceWebWorker_async()
{
	if (!window.Worker)
		return;

	var map = this._mapWordFrequencies;
	var reduce = this._reduceWordFrequencies;
	this._setupTestDb(function(db)
	{
		db.view(
		{
			map: map,
			reduce: reduce,
			mapReducer: new BrowserCouch.WebWorkerMapReducer(2),
			chunkSize: 1,
			finished: function(result)
			{
				var expected = {
					rows: [
						{key: "dogen", value: 1},
						{key: "dude", value: 1},
						{key: "hello", value: 2},
						{key: "there", value: 2}
					]
				};
				self.assertEqual(JSON.stringify(expected),
					JSON.stringify(result));
				self.done();
			}
		});
	});
}

function testViewMapReduce_async()
{
	var map = this._mapWordFrequencies;
	var reduce = this._reduceWordFrequencies;
	this._setupTestDb(function(db)
	{
		db.view(
		{
			map: map,
			reduce: reduce,
			finished: function(result)
			{
				var expected = {
					rows: [
						{key: "dogen", value: 1},
						{key: "dude", value: 1},
						{key: "hello", value: 2},
						{key: "there", value: 2}
					]
				};
				self.assertEqual(JSON.stringify(expected),
					JSON.stringify(result));
				self.done();
			}
		});
	});
}

function testLocalStorage_async()
{
    if (!BrowserCouch.LocalStorage.isAvailable)
    	return;
    	
	BrowserCouch.ModuleLoader.require(
		"JSON",
		function()
		{
			var storage = new BrowserCouch.LocalStorage(JSON);
			var name = "BrowserCouch_test_DB";

			var data = {test: "hi",
					  foo: [1,2,3]};

			storage.put(
				name,
				data,
				function()
				{
					storage.get(
						name,
						function(returnedData)
						{
							if (data == returnedData)
								throw new Error("Returned data should not be " +
												"the same object as passed-in " +
												"data.");
							self.assertEqual(JSON.stringify(data),
										   JSON.stringify(returnedData));
							self.done();
						});
				});
		});
}

function testLocalSync()
{
	var db1 = new BrowserCouchClass('browserSyncTest');
	var db2 = new BrowserCouchClass('browserSyncTest2');
	db1.put([{_id:'0', foo:'bar'}], 
		function()
		{
			db2.sync(db1,
				{
					update: function()
					{
						db2.get('0', 
							function(x)
							{
								self.assertEqual(x['foo'], 'bar');
							}
						);
					}
				});
	   });
}

function testAllDbs()
{
	var db = new BrowserCouchClass('testAllDbs');
	db.commitToStorage(function()
	{
		db.allDbs(function(dbs)
		{
			self.assertContains('testAllDbs', dbs);
		});
	});
}

